# Orca — A Modular Personal Server Orchestrator

Orca is a web interface to manage a personal server. It aims to make common ops tasks simple, safe, and modular:

- Launch and manage Docker containers
- Deploy a GitHub repository into a container
- Configure a reverse proxy (when present)
- Configure a firewall (when present)

The backend is built with FastAPI, while the frontend uses Jinja2 templates and HTMX for dynamic interactions without heavy client-side frameworks.

---

## Why Orca?
Personal servers are powerful but fiddly. Orca’s goal is to provide a small, self-hosted control panel that:

- Stays simple and transparent
- Works with existing tools (Docker, Nginx/Traefik, nftables/iptables)
- Is modular so you can swap providers (e.g., pick your reverse proxy or firewall)
- Keeps you in control with a thin, auditable codebase

---

## Features (planned)
- Docker
  - Create, start, stop, restart containers
  - Basic templates for common services
  - Logs and health checks
- GitHub Deploy
  - Clone/pull a repository
  - Build container image (Dockerfile or templates)
  - Run with environment/volume presets
- Reverse Proxy (modular)
  - Providers: Nginx, Traefik (first-class)
  - Auto-route services by hostname, TLS support
- Firewall (modular)
  - Providers: ufw, firewalld, nftables
  - Open/close ports per service
- Observability
  - Light host metrics (CPU, memory, uptime)
  - Service health endpoints

---

## Architecture
- FastAPI backend with an app factory (`app/__init__.py:create_app`) and modular routers.
- API routes live under `app/api/routes.py`; page routes under `app/web/routes.py`.
- `app/main.py` exposes the ASGI `app` for uvicorn.
- Jinja2 + HTMX frontend renders server views, progressively enhanced with small JS helpers.
- Modular provider design (WIP):
  - Reverse proxy providers (e.g., Nginx, Traefik)
  - Firewall providers (e.g., ufw, iptables, firewalld)
  - Container runtime (Docker)
- Streaming updates use SSE for low-latency UI without heavy JS.

---

## Tech Stack
- Backend: FastAPI, Starlette
- Templates: Jinja2
- Frontend: HTMX + small vanilla JS helpers
- Metrics: psutil (example)
- Dev server: uvicorn

---

## Repository Layout
```
app/
  __init__.py         # create_app() factory, mounts, router include
  main.py             # ASGI entrypoint: app = create_app()
  metrics.py          # Host metrics (example)
  api/
    routes.py         # REST + SSE endpoints (/api/*)
  web/
    routes.py         # Page routes (e.g., "/")
  static/             # JS/CSS assets
  templates/          # Jinja2 templates
requirements.txt      # Python dependencies
```

---

## Quick Start
Prerequisites: Python 3.10+ (3.12 recommended)

1) Create and activate a virtual environment
- Unix/macOS
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```
- Windows (PowerShell)
  ```powershell
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  ```

2) Install dependencies
```bash
pip install -r requirements.txt
```

3) Run the development server
```bash
uvicorn app.main:app --reload
```

4) Open the UI
- Visit http://localhost:8000 to see the metrics example page.

---

## Configuration
- Bind host/port with uvicorn flags: `--host 0.0.0.0 --port 8000`.
- Reverse proxy deployment is recommended for production (Nginx/Traefik). TLS termination and authentication should be handled by your proxy while Orca’s built‑in features evolve.

---

## Security Notes
- Orchestration actions (Docker, firewall) may require elevated privileges. Run Orca behind authentication and a reverse proxy; scope its permissions carefully.
- Plan to add:
  - Authentication (session or OAuth proxy)
  - Role/permission model for sensitive actions
  - Audit logging of administrative operations

---

## Roadmap
- Provider interfaces and first implementations:
  - Docker runtime provider
  - Nginx and Traefik reverse proxy providers
  - Firewall provider (ufw first)
- GitHub deploy flow (clone/build/run) with presets
- Service templates and per‑service config UI
- Auth, RBAC-lite, and audit log
- Backup/restore of configuration

---

## Contributing
- Ideas and PRs welcome while the provider API stabilizes.
- Keep changes small and focused; prefer incremental PRs.
- If proposing a new provider, include a short design note: responsibilities, configuration surface, and expected commands/integration points.

---

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
