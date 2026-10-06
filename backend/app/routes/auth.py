from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.users import User
from app.auth import verify_password, issue_token, get_current_user, hash_password
from app import login_limiter

# Compared against when the username doesn't exist, so a wrong username takes
# as long as a wrong password and can't be told apart by timing.
_DUMMY_HASH = hash_password("not-a-real-password")

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
def login(
    request:   Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db:        Session = Depends(get_db)
):
    username = form_data.username.strip().lower()
    forwarded = request.headers.get("x-forwarded-for")
    # Rightmost entry is the one appended by our own proxy; earlier ones are client-supplied.
    ip = forwarded.split(",")[-1].strip() if forwarded else (request.client.host if request.client else "unknown")

    wait = login_limiter.retry_after(db, username, ip)
    if wait:
        raise HTTPException(
            status_code = status.HTTP_429_TOO_MANY_REQUESTS,
            detail      = f"Too many failed login attempts. Try again in {wait // 60 + 1} minute(s).",
            headers     = {"Retry-After": str(wait)},
        )

    # Prefer the active account: a deactivated employee's row may share the username.
    user = (
        db.query(User)
        # Case-insensitive: older accounts were saved with capitals (e.g. "Dheeraj").
        .filter(func.lower(User.username) == username)
        .order_by(User.active.desc())
        .first()
    )

    if not verify_password(form_data.password, user.password_hash if user else _DUMMY_HASH) or not user:
        login_limiter.record_failure(db, username, ip)
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Incorrect username or password"
        )

    login_limiter.reset(db, username)

    if not user.active:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "Account is disabled"
        )

    token = issue_token(user)

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "user_id":       user.user_id,
            "full_name":     user.full_name,
            "employee_code": user.employee_code,
            "role":          user.role.name,
        }
    }

@router.get("/me")
def get_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {
        "user_id":       current_user.user_id,
        "full_name":     current_user.full_name,
        "employee_code": current_user.employee_code,
        "role":          current_user.role.name,
        "active":        current_user.active,
    }