from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os
from dotenv import load_dotenv
import hashlib
from contextlib import asynccontextmanager

from .db import init_db, ensure_default_admin


load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_default_admin()
    yield


app = FastAPI(title="Metrics API", version="0.1.0", lifespan=lifespan)

base_dir = Path(__file__).resolve().parent
static_dir = str(base_dir / "static")
templates_dir = str(base_dir / "templates")

# Mount static files and configure templates
app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.state.templates = Jinja2Templates(directory=templates_dir)

# Gravatar filter for Jinja templates
def _gravatar(email: str, size: int = 32, default: str = "identicon") -> str:
    if not email:
        return f"https://www.gravatar.com/avatar/?s={size}&d={default}"
    h = hashlib.md5(email.strip().lower().encode("utf-8")).hexdigest()
    return f"https://www.gravatar.com/avatar/{h}?s={size}&d={default}"

app.state.templates.env.filters["gravatar"] = _gravatar

# Routers
from .api.routes import router as api_router
from .web.routes import router as web_router
from .web.auth import router as auth_router

app.include_router(web_router)
app.include_router(api_router)
app.include_router(auth_router)


class LoginRequiredMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        if (
            path.startswith("/static")
            or path.startswith("/api")
            or path == "/login"
            or path == "/logout"
            or path == "/healthz"
        ):
            return await call_next(request)

        if not request.session.get("user_id"):
            return RedirectResponse(url="/login", status_code=302)

        return await call_next(request)


app.add_middleware(LoginRequiredMiddleware)

SECRET_KEY = os.getenv("ORCA_SECRET_KEY", "dev-secret-change-me")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
