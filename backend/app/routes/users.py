from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from app.database import get_db
from app.models.users import User, Role
from app.models.audit import AuditLog
from app.schemas.users import UserCreate, UserResponse, PasswordChange
from app.auth import get_current_user, hash_password, verify_password, issue_token
from app.permissions import require_admin

router = APIRouter(prefix="/users", tags=["Users"])

MIN_PASSWORD_LENGTH = 8


class UsernameChange(BaseModel):
    new_username: str


class NameChange(BaseModel):
    new_name: str


class CodeChange(BaseModel):
    new_code: Optional[str] = None


class RoleChange(BaseModel):
    new_role_id: int


def _validate_password(password: str):
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long"
        )


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
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
    current_user: User = Depends(require_admin)
):
    _validate_password(data.password)

    new_role = db.query(Role).filter(Role.role_id == data.role_id).first()
    if not new_role:
        raise HTTPException(status_code=404, detail="Role not found")

    if new_role.name == "owner" and current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can create an owner account")

    if new_role.name == "manager" and current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can create a manager account")

    username = data.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    # Only active users block a username. A deactivated (removed) employee's
    # username becomes available for reuse by a new employee.
    existing = db.query(User).filter(User.username == username, User.active == True).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        full_name=data.full_name.strip(),
        username=username,
        password_hash=hash_password(data.password),
        employee_code=data.employee_code,
        role_id=data.role_id,
        active=True,
    )
    db.add(user)
    db.flush()

    db.add(AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="CREATE",
        new_value=f"username={username} role={new_role.name}",
        changed_by=current_user.user_id,
    ))
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
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if user.role.name == "owner":
        raise HTTPException(status_code=400, detail="An owner account cannot be deactivated")
    if user.role.name == "manager" and current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove a manager")

    user.active = False
    db.add(AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="DELETE",
        old_value=f"username={user.username} active=True",
        new_value="active=False",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"Employee {user.full_name} has been deactivated"}


@router.post("/change-username")
def change_username(
    data: UsernameChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new = data.new_username.strip().lower()
    if not new:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    taken = db.query(User).filter(User.username == new, User.user_id != current_user.user_id, User.active == True).first()
    if taken:
        raise HTTPException(status_code=400, detail="Username already taken")

    if current_user.role.name != "owner":
        last = current_user.username_changed_at
        if last:
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            days_since = (datetime.now(timezone.utc) - last).days
            if days_since < 7:
                raise HTTPException(
                    status_code=400,
                    detail=f"Username can only be changed once every 7 days. Try again in {7 - days_since} day(s)."
                )

    old_username = current_user.username
    current_user.username = new
    current_user.username_changed_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        table_name="users",
        record_id=current_user.user_id,
        action="UPDATE",
        field_name="username",
        old_value=old_username,
        new_value=new,
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Username changed successfully", "new_username": new}


@router.post("/{user_id}/change-name")
def change_name(
    user_id: int,
    data: NameChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can change an employee's name")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role.name == "owner" and user.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You cannot edit another owner's account")

    new = data.new_name.strip()
    if not new:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    old_name = user.full_name
    user.full_name = new

    db.add(AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="UPDATE",
        field_name="full_name",
        old_value=old_name,
        new_value=new,
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"Name changed to {new}"}


@router.post("/{user_id}/change-code")
def change_code(
    user_id: int,
    data: CodeChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can change an employee's code")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role.name == "owner" and user.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You cannot edit another owner's account")

    new = (data.new_code or "").strip() or None
    if new:
        taken = db.query(User).filter(User.employee_code == new, User.user_id != user_id, User.active == True).first()
        if taken:
            raise HTTPException(status_code=400, detail="That code is already used by another employee")

    old_code = user.employee_code
    user.employee_code = new

    db.add(AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="UPDATE",
        field_name="employee_code",
        old_value=str(old_code),
        new_value=str(new),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Code updated"}


@router.post("/{user_id}/change-role")
def change_role(
    user_id: int,
    data: RoleChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can change an employee's role")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role.name == "owner":
        raise HTTPException(status_code=400, detail="An owner's role cannot be changed")

    new_role = db.query(Role).filter(Role.role_id == data.new_role_id).first()
    if not new_role:
        raise HTTPException(status_code=404, detail="Role not found")

    if new_role.name == "owner":
        raise HTTPException(
            status_code=403,
            detail="Users cannot be promoted to owner. Owner accounts must be created deliberately."
        )

    old_role = user.role.name
    user.role_id = data.new_role_id

    db.add(AuditLog(
        table_name="users",
        record_id=user.user_id,
        action="UPDATE",
        field_name="role",
        old_value=old_role,
        new_value=new_role.name,
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"Role changed to {new_role.name}"}


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
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

    _validate_password(data.new_password)

    current_user.password_hash = hash_password(data.new_password)
    db.add(AuditLog(
        table_name="users",
        record_id=current_user.user_id,
        action="UPDATE",
        field_name="password",
        new_value="changed",
        changed_by=current_user.user_id,
    ))
    db.commit()
    # Every token issued before this change is now rejected. Hand back a fresh
    # one so the session that made the change stays signed in.
    return {"message": "Password changed successfully", "access_token": issue_token(current_user)}