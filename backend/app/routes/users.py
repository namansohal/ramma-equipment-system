from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.users import User, Role
from app.models.audit import AuditLog
from app.schemas.users import UserCreate, UserResponse, PasswordChange
from app.auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/users", tags=["Users"])


def require_owner_or_manager(current_user: User = Depends(get_current_user)):
    if current_user.role.name not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Only owner or manager can manage users")
    return current_user


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    users = db.query(User).filter(User.active == True).all()
    return [
        {
            "user_id": u.user_id,
            "full_name": u.full_name,
            "username": u.username,
            "employee_code": u.employee_code,
            "role": u.role.name,
            "active": u.active,
        }
        for u in users
    ]


@router.post("/", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        full_name=data.full_name,
        username=data.username,
        password_hash=hash_password(data.password),
        employee_code=data.employee_code,
        role_id=data.role_id,
        active=True,
    )
    db.add(user)
    db.flush()

    audit = AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="CREATE",
        new_value=f"username={data.username} role_id={data.role_id}",
        changed_by=current_user.user_id,
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "username": user.username,
        "employee_code": user.employee_code,
        "role": user.role.name,
        "active": user.active,
    }


@router.delete("/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if user.role.name == "owner":
        raise HTTPException(status_code=400, detail="The owner account cannot be deactivated")

    user.active = False

    audit = AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="DELETE",
        old_value=f"username={user.username} active=True",
        new_value="active=False",
        changed_by=current_user.user_id,
    )
    db.add(audit)
    db.commit()
    return {"message": f"Employee {user.full_name} has been deactivated"}


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager)
):
    roles = db.query(Role).all()
    return [{"role_id": r.role_id, "name": r.name} for r in roles]


@router.post("/change-password")
def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(data.new_password)

    audit = AuditLog(
        table_name="users",
        record_id=current_user.user_id,
        action="UPDATE",
        field_name="password",
        new_value="changed",
        changed_by=current_user.user_id,
    )
    db.add(audit)
    db.commit()
    return {"message": "Password changed successfully"}