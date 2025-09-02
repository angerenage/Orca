from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from app.metrics import get_address, get_hostname, get_uptime


router = APIRouter()


@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    templates = request.app.state.templates

    uptime = get_uptime()
    days = uptime // 86400
    hours = (uptime % 86400) // 3600
    minutes = (uptime % 3600) // 60
    seconds = uptime % 60

    return templates.TemplateResponse("index.html", {
        "request": request,
        "server_name": get_hostname(),
        "uptime_formatted": f"{days}d {hours}h {minutes}m {seconds}s",
        "ip": get_address(True)
    })
