const PercentChart = (target, title, series, opts = {}) => {
    const el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) throw new Error('PercentChart: target element not found');

    [...el.querySelectorAll('.legend')].forEach(lg => {
        if (!lg.closest('.chart-header')) lg.remove();
    });
    let headerWrap = el.querySelector('.chart-header');
    if (!headerWrap) {
        headerWrap = document.createElement('div');
        headerWrap.className = 'chart-header';
        el.prepend(headerWrap);
    }

    let titleEl = headerWrap.querySelector('h2');
    if (!titleEl) {
        titleEl = document.createElement('h2');
        headerWrap.appendChild(titleEl);
    }
    titleEl.classList.add('m-0');
    titleEl.textContent = title || '';

    // Config
    const cfg = {
        width: opts.width ?? 720,
        height: opts.height ?? 260,
        margins: { top: 16, right: 16, bottom: 28, left: 40 },
        gridY: opts.gridY ?? true,
        gridX: opts.gridX ?? false,
        strokeWidth: opts.strokeWidth ?? 2,
        palette: opts.palette ?? [
            '#7aa2f7', '#9ece6a', '#f7768e', '#e0af68', '#bb9af7', '#7dcfff', '#c0caf5'
        ],
        legend: opts.legend ?? true,
        interactive: opts.interactive ?? true,
        monospaceLabels: opts.monospaceLabels ?? false,
        legendFormat: typeof opts.legendFormat === 'function'
            ? opts.legendFormat
            : (v) => (v == null || Number.isNaN(v)) ? '' : `${Number(v).toFixed(0)}%`,
        legendValues: opts.legendValues,
    };

    const svgNS = 'http://www.w3.org/2000/svg';
    const fmtTime = (t) => {
        if (t == null || Number.isNaN(t)) return '';
        const ms = ('' + t).length > 10 ? Number(t) : Number(t) * 1000;
        const d = new Date(ms);
        try {
            return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (_) {
            return d.toISOString().split('T')[1].slice(0, 8);
        }
    };
    const mk = (tag, attrs = {}, parent) => {
        const n = document.createElementNS(svgNS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
    };

    let bodyWrap = el.querySelector('.chart-body');
    if (!bodyWrap) {
        bodyWrap = document.createElement('div');
        bodyWrap.className = 'chart-body';
        el.appendChild(bodyWrap);
    }

    const svg = mk('svg', {
        viewBox: `0 0 ${cfg.width} ${cfg.height}`,
        class: 'chart',
        role: 'img',
        'aria-label': 'Percent line chart'
    });
    bodyWrap.innerHTML = '';
    bodyWrap.appendChild(svg);

    const { top, right, bottom, left } = cfg.margins;
    const innerW = cfg.width - left - right;
    const innerH = cfg.height - top - bottom;

    // Layers
    const gGrid = mk('g', { transform: `translate(${left},${top})` }, svg);
    const gAxes = mk('g', null, svg);
    const gSeries = mk('g', { transform: `translate(${left},${top})` }, svg);
    const gOverlay = mk('g', { transform: `translate(${left},${top})` }, svg);

    // Axes lines
    mk('line', { x1: left, y1: top + innerH, x2: left + innerW, y2: top + innerH, stroke: 'var(--border-hard)', 'stroke-width': 1 }, gAxes);
    mk('line', { x1: left, y1: top, x2: left, y2: top + innerH, stroke: 'var(--border-hard)', 'stroke-width': 1 }, gAxes);

    // Y ticks (0,25,50,75,100)
    const yTicks = [25, 50, 75, 100];
    for (const v of yTicks) {
        const y = top + (1 - v / 100) * innerH;
        if (cfg.gridY) mk('line', { x1: left, y1: y, x2: left + innerW, y2: y, stroke: 'var(--border)', 'stroke-width': 1, 'stroke-dasharray': '6 2' }, svg);
        const label = mk('text', { x: left - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: 'var(--text-secondary)', 'font-size': 11, 'font-family': cfg.monospaceLabels ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : undefined }, svg);
        label.textContent = v + '%';
    }

    // X ticks (optional minimal)
    const drawXTicks = (n) => {
        [...svg.querySelectorAll('text[data-x]')].forEach(n => n.remove());
        if (n < 2) return;
        const positions = [0, Math.floor((n - 1) / 2), n - 1];
        for (const i of positions) {
            const x = left + (n === 1 ? innerW / 2 : i * (innerW / (n - 1)));
            const label = mk('text', { x, y: top + innerH + 16, 'text-anchor': i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle'), fill: 'var(--text-secondary)', 'font-size': 11, 'data-x': i }, svg);
            const t = state.times?.[i];
            label.textContent = (t != null) ? fmtTime(t) : i;
        }
    };

    // Legend
    let legendEl = headerWrap.querySelector('.legend');
    if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.className = 'legend';
        headerWrap.appendChild(legendEl);
    }
    let currentValues = [];
    let customLegendValues = Array.isArray(cfg.legendValues)
        ? cfg.legendValues.slice()
        : (typeof cfg.legendValues === 'function' ? null : []);

    const drawLegend = (series, values = []) => {
        if (!cfg.legend) return;
        legendEl.innerHTML = '';
        series.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'legend-item';

            const sw = document.createElement('span');
            sw.className = 'legend-swatch';
            sw.style.background = s.color || cfg.palette[i % cfg.palette.length];
            item.appendChild(sw);

            const txt = document.createElement('span');
            txt.textContent = s.name ?? `Series ${i+1}`;
            txt.style.marginRight = '6px';
            item.appendChild(txt);

            if (values[i] !== undefined && values[i] !== null) {
                const val = document.createElement('span');
                val.className = 'legend-value';
                const vv = values[i];
                val.textContent = (typeof vv === 'string') ? vv : cfg.legendFormat(vv, i, s);
                item.appendChild(val);
            }
            legendEl.appendChild(item);
        });
    };

    // Helpers
    const clamp01 = (v) => Math.max(0, Math.min(100, v));
    const xy = (i, v, n) => {
        const x = i === 0 && n === 1 ? innerW / 2 : (n === 1 ? innerW / 2 : i * (innerW / (n - 1)));
        const y = (1 - clamp01(v) / 100) * innerH;
        return [x, y];
    };

    const buildPath = (arr) => {
        const n = arr.length;
        if (!n) return '';
        let d = '';
        for (let i = 0; i < n; i++) {
            const [x, y] = xy(i, arr[i], n);
            d += (i ? ' L ' : 'M ') + x.toFixed(2) + ' ' + y.toFixed(2);
        }
        return d;
    };

    const state = { series: [], times: Array.isArray(opts.times) ? opts.times.slice() : [] };
    const getCurrentValues = () => state.series.map(s => {
        if (!s.data || !s.data.length) return null;
        return Math.max(0, Math.min(100, Number(s.data[s.data.length - 1])));
    });

    const draw = () => {
        gSeries.innerHTML = '';

        const n = Math.max(0, ...state.series.map(s => s.data.length));
        drawXTicks(n);

        state.series.forEach((s, i) => {
            const color = s.color || cfg.palette[i % cfg.palette.length];
            mk('path', { d: buildPath(s.data), fill: 'none', stroke: color, 'stroke-width': cfg.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gSeries);
        });

        if (cfg.gridX && n > 1) {
            for (let i = 0; i < n; i++) {
                const x = i * (innerW / (n - 1));
                mk('line', { x1: x, y1: 0, x2: x, y2: innerH, stroke: 'var(--border)', 'stroke-width': 1.5 }, gGrid);
            }
        }

        const legendVals = (customLegendValues && customLegendValues.length)
            ? customLegendValues
            : getCurrentValues();
        drawLegend(state.series, legendVals);
    };

    // Tooltip & hover
    const tooltip = (() => {
        if (!cfg.interactive) return null;
        const cross = mk('line', { x1: 0, y1: 0, x2: 0, y2: innerH, stroke: 'var(--border)', 'stroke-width': 1 }, gOverlay);

        let dots = [];
        let hovering = false;
        let activeIdx = null;
        let activeRatio = null;

        const syncDots = () => {
            dots.forEach(d => d.remove());
            dots = state.series.map((_, i) =>
                mk('circle', { class: 'tooltip-dot', r: 3.5, fill: state.series[i]?.color || cfg.palette[i % cfg.palette.length], cx: -10, cy: -10 }, gOverlay)
            );
        };
        syncDots();

        const box = mk('g', null, svg);
        const rect = mk('rect', { rx: 6, ry: 6, fill: 'var(--bg-base)', stroke: 'var(--border)', 'stroke-width': 1.5 }, box);
        const label = mk('text', { x: 0, y: 0, fill: 'var(--text-secondary)', 'font-size': 12 }, box);
        box.style.display = 'none';

        const setVisible = (vis) => {
            const v = vis ? null : 'none';
            if (v) {
                cross.setAttribute('display', 'none');
                dots.forEach(d => d.setAttribute('display', 'none'));
                box.style.display = 'none';
            }
            else {
                cross.removeAttribute('display');
                dots.forEach(d => d.removeAttribute('display'));
                box.style.display = 'block';
            }
        };

        const update = (idx) => {
            const n = state.series[0]?.data.length || 0;
            if (!n || idx == null) { activeIdx = null; setVisible(false); return; }
            const x = left + (n === 1 ? innerW / 2 : idx * (innerW / (n - 1)));
            cross.setAttribute('x1', x - left);
            cross.setAttribute('x2', x - left);

            let lines = [];
            state.series.forEach((s, i) => {
                const v = clamp01(s.data[Math.min(idx, s.data.length - 1)] ?? 0);
                const [px, py] = xy(idx, v, n);
                if (!dots[i]) {
                    syncDots();
                }
                if (dots[i]) {
                    dots[i].setAttribute('cx', px);
                    dots[i].setAttribute('cy', py);
                }
                lines.push(`${s.name ?? `Series ${i+1}`}: ${v.toFixed(0)}%`);
            });

            const ts = state.times?.[Math.min(idx, state.times.length - 1)];
            const when = (ts != null) ? fmtTime(ts) : `x=${idx}`;
            label.textContent = `${when}  |  ${lines.join('  ·  ')}`;

            const bb = label.getBBox();
            rect.setAttribute('x', x - bb.width / 2 - 8);
            rect.setAttribute('y', top - 6 - bb.height);
            rect.setAttribute('width', bb.width + 16);
            rect.setAttribute('height', bb.height + 12);
            label.setAttribute('x', x - bb.width / 2);
            label.setAttribute('y', top + 2);
            setVisible(true);

            activeIdx = idx;
        };

        const onMove = (evt) => {
            const n = state.series[0]?.data.length || 0;
            if (!n) return;

            const pt = svg.createSVGPoint();
            pt.x = evt.clientX; pt.y = evt.clientY;

            const ctm = svg.getScreenCTM();
            const p = pt.matrixTransform(ctm.inverse());
            const rx = Math.max(0, Math.min(innerW, p.x - left));

            const ratio = innerW ? (rx / innerW) : 0;
            const idx = Math.round(ratio * (n - 1));

            hovering = true;
            activeRatio = ratio;
            update(idx);
        };

        svg.addEventListener('mousemove', onMove);
        svg.addEventListener('mouseenter', () => { hovering = true; });
        svg.addEventListener('mouseleave', () => { hovering = false; activeIdx = null; activeRatio = null; update(null); });

        const afterData = () => {
            const n = state.series[0]?.data.length || 0;
            if (!hovering || !n) {
                update(null);
                return;
            }

            let idx = activeIdx;
            if (activeRatio != null) idx = Math.round(activeRatio * (n - 1));
            if (idx == null) return;

            update(Math.min(idx, n - 1));
        };

        return { update, syncDots, afterData };
    })();

    const setData = (series, times, legendValues) => {
        state.series = (series ?? []).map((s, i) => ({
            name: s.name ?? `Series ${i+1}`,
            data: Array.isArray(s.data) ? s.data.map(Number) : [],
            color: s.color || cfg.palette[i % cfg.palette.length]
        }));

        if (Array.isArray(times)) state.times = times.slice();

        if (Array.isArray(legendValues)) {
            customLegendValues = legendValues.slice();
        }
        else if (typeof cfg.legendValues === 'function') {
            try { customLegendValues = cfg.legendValues(state.series, state.times) || []; }
            catch (_) { customLegendValues = []; }
        }
        else if (Array.isArray(cfg.legendValues)) {
            customLegendValues = cfg.legendValues.slice();
        }
        else {
            customLegendValues = [];
        }

        currentValues = getCurrentValues();
        const legendVals = (customLegendValues && customLegendValues.length)
            ? customLegendValues
            : currentValues;

        drawLegend(state.series, legendVals);
        draw();

        if (tooltip) {
            tooltip.syncDots();
            tooltip.afterData();
        }
    };

    setData(series, state.times);
    const setTimes = (times) => { if (Array.isArray(times)) { state.times = times.slice(); draw(); if (tooltip) tooltip.afterData(); } };
    const setLegendValues = (values) => { if (Array.isArray(values)) { customLegendValues = values.slice(); drawLegend(state.series, customLegendValues); } };
    return { setData, setTimes, setLegendValues, svg };
};
