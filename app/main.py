from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="Metrics API", version="0.1.0")

base_dir = Path(__file__).resolve().parent
static_dir = str(base_dir / "static")
templates_dir = str(base_dir / "templates")

# Mount static files and configure templates
app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.state.templates = Jinja2Templates(directory=templates_dir)

# Routers
from .api.routes import router as api_router
from .web.routes import router as web_router

app.include_router(web_router)
app.include_router(api_router)
