const streams = new WeakMap();
const STREAMS = new Map(); // key -> manager { es, cache, subscribers, eventName, url }

function escapeHTML(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function toHTMLString(output) {
    if (output == null) return '';
    if (typeof output === 'string') return output;
    if (output instanceof Node) return output.outerHTML || '';
    // Fallback: stringify objects
    try {
        return `<pre>${escapeHTML(JSON.stringify(output, null, 2))}</pre>`;
    } catch (_) {
        return String(output);
    }
}

function trimToLimit(el, state) {
    while (state.cache.length > state.limit) {
        if (state.mode === 'prepend') {
            state.cache.pop();
            if (el.lastElementChild) el.removeChild(el.lastElementChild);
        }
        else {
            state.cache.shift();
            if (el.firstElementChild) el.removeChild(el.firstElementChild);
        }
    }
}

function setup(el) {
    if (streams.has(el)) return;

    const urlAttr =
        el.getAttribute('sse-url') ||
        el.getAttribute('sse-connect') ||
        el.dataset.sseUrl;

    const limit = parseInt(
        el.getAttribute('sse-cache-size') || el.dataset.sseCacheSize || '20',
        10
    );
    const eventName = (el.getAttribute('sse-event') || 'message').toLowerCase();
    const mode = (el.getAttribute('sse-mode') || 'append').toLowerCase();
    const withCreds = el.hasAttribute('sse-credentials');
    const escapeAttr = el.hasAttribute('sse-escape');
    const renderName = el.getAttribute('sse-render');
    const renderFn = renderName && typeof window[renderName] === 'function'
        ? window[renderName]
        : null;
    if (!urlAttr) return;

    const state = {
        cache: [], // holds data objects if renderFn is set, else HTML strings
        limit,
        mode,
        eventName,
        renderFn,
        escapeAttr
    };

    // Seed initial cache only for non-renderFn mode (HTML streaming)
    if (!state.renderFn) {
        state.cache = Array.from(el.children).map(ch => ch.outerHTML);
        trimToLimit(el, state);
    }

    // If a custom renderer is present, subscribe to a shared stream manager
    if (renderFn) {
        const manager = getOrCreateManager({ url: urlAttr, eventName, withCreds });
        const subscriber = {
            el,
            limit,
            renderFn,
            onData(history) {
                const slice = history.length > this.limit
                    ? history.slice(history.length - this.limit)
                    : history.slice();
                try {
                    const output = this.renderFn(slice, this.el, state);
                    if (output !== undefined && output !== null) {
                        const html = toHTMLString(output);
                        this.el.innerHTML = html;
                    }
                } catch (err) {
                    console.error('sse-render error:', err);
                }
            }
        };
        manager.subscribers.add(subscriber);
        subscriber.onData(manager.cache);
        document.body.addEventListener('htmx:beforeCleanupElement', (evt) => {
            if (evt.target === el) {
                manager.subscribers.delete(subscriber);
                streams.delete(el);
                if (manager.subscribers.size === 0) {
                    try { manager.es && manager.es.close(); } catch (_) {}
                    STREAMS.delete(manager.key);
                }
            }
        });
        streams.set(el, { manager, state, subscriber });
        return;
    }

    // Fallback: create a direct EventSource for raw HTML streaming
    const url = urlAttr;
    if (!url) return;
    const es = new EventSource(url, { withCredentials: withCreds });

    function pushHTML(html) {
        if (state.mode === 'prepend') {
            el.insertAdjacentHTML('afterbegin', html);
            state.cache.unshift(html);
            while (state.cache.length > state.limit) {
                state.cache.pop();
                if (el.lastElementChild) el.removeChild(el.lastElementChild);
            }
        } else {
            el.insertAdjacentHTML('beforeend', html);
            state.cache.push(html);
            while (state.cache.length > state.limit) {
                state.cache.shift();
                if (el.firstElementChild) el.removeChild(el.firstElementChild);
            }
        }
    }

    function onMessage(e) {
        // If a custom renderer is provided, keep a history of parsed data
        if (state.renderFn) {
            let obj;
            try {
                obj = JSON.parse(e.data);
            } catch (_) {
                // Non-JSON payloads: store raw string
                obj = e.data;
            }

            if (state.mode === 'prepend') {
                state.cache.unshift(obj);
                while (state.cache.length > state.limit) state.cache.pop();
            }
            else {
                state.cache.push(obj);
                while (state.cache.length > state.limit) state.cache.shift();
            }

            // Call renderer with the full cache
            try {
                const output = state.renderFn(state.cache.slice(), el, state);
                if (output !== undefined && output !== null) {
                    const html = toHTMLString(output);
                    el.innerHTML = html;
                }
            } catch (err) {
                // If render fails, keep last known DOM and log to console
                console.error('sse-render error:', err);
            }
            return;
        }

        // Default: stream HTML into the element
        let html = e.data;
        if (state.escapeAttr) {
            html = `<pre>${escapeHTML(String(e.data))}</pre>`;
        }
        pushHTML(html);
    }

    es.addEventListener(state.eventName, onMessage);
    es.onerror = () => {
        // We let EventSource handle reconnection (based on 'retry:' from server)
    };

    document.body.addEventListener('htmx:beforeCleanupElement', (evt) => {
        if (evt.target === el) {
            try { es.close(); } catch (_) {}
            streams.delete(el);
        }
    });

    window.addEventListener('beforeunload', () => {
        try { es.close(); } catch (_) {}
    });

    streams.set(el, { es, state });
}

function initAll() {
    const selector = '[sse-url], [data-sse-url]';
    document.querySelectorAll(selector).forEach((el) => setup(el));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
}
else {
    initAll();
}

// Close all shared streams on unload
window.addEventListener('beforeunload', () => {
    STREAMS.forEach((m) => { try { m.es && m.es.close(); } catch (_) {} });
});

// Expose a tiny API for manual control if needed
function getOrCreateManager({ url, eventName = 'message', withCreds = false }) {
    if (!url) throw new Error('SSE: stream URL not resolved');

    const key = `url:${url}|event:${eventName}|creds:${withCreds ? 1 : 0}`;
    if (STREAMS.has(key)) return STREAMS.get(key);

    const manager = {
        key,
        url,
        eventName,
        withCreds,
        es: null,
        cache: [],
        maxCache: 1000,
        subscribers: new Set()
    };
    const es = new EventSource(manager.url, { withCredentials: manager.withCreds });
    const onEvent = (e) => {
        let obj;
        try { obj = JSON.parse(e.data); } catch (_) { obj = e.data; }
        manager.cache.push(obj);
        if (manager.cache.length > manager.maxCache) manager.cache.shift();
        manager.subscribers.forEach((sub) => {
            try { sub.onData(manager.cache); } catch (err) { console.error('subscriber error:', err); }
        });
    };
    es.addEventListener(manager.eventName, onEvent);
    es.onerror = () => { /* rely on SSE retry */ };
    manager.es = es;
    STREAMS.set(key, manager);
    return manager;
}

window.SSECache = { setup, init: initAll };
