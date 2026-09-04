from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.users import User
from app.auth import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db:        Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Incorrect username or password"
        )

    if not user.active:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail      = "Account is disabled"
        )

    token = create_access_token(data={
        "sub":  user.username,
        "role": user.role.name,
        "uid":  user.user_id,
    })

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
def get_me(db: Session = Depends(get_db), current_user: User = Depends(__import__('app.auth', fromlist=['get_current_user']).get_current_user)):
    return {
        "user_id":       current_user.user_id,
        "full_name":     current_user.full_name,
        "employee_code": current_user.employee_code,
        "role":          current_user.role.name,
        "active":        current_user.active,
    }