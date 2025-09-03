from __future__ import annotations

from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.db import get_db, verify_password
from app.models import User


router = APIRouter()


@router.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    templates = request.app.state.templates
    return templates.TemplateResponse("login.html", {"request": request, "error": None})


@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    email = form.get("email")
    if not isinstance(email, str):
        templates = request.app.state.templates
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Invalid email format."},
            status_code=400,
        )
    email = email.strip().lower()

    password = form.get("password")
    if not isinstance(password, str):
        templates = request.app.state.templates
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Invalid password format."},
            status_code=400,
        )

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        templates = request.app.state.templates
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Invalid credentials."},
            status_code=401,
        )

    request.session["user_id"] = user.id
    request.session["user_email"] = user.email
    resp = RedirectResponse(url="/", status_code=302)
    return resp


@router.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=302)
