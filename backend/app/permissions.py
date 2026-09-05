from fastapi import Depends, HTTPException
from app.auth import get_current_user
from app.models.users import User

# Role hierarchy levels (higher number = more authority)
ROLE_LEVEL = {
    "viewer": 1,
    "store_keeper": 2,
    "employee": 2,
    "manager": 3,
    "owner": 4,
}


def require_editor(current_user: User = Depends(get_current_user)):
    """Blocks view-only users from creating/editing/deleting."""
    if current_user.role.name == "viewer":
        raise HTTPException(status_code=403, detail="View-only account cannot make changes")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)):
    """Only owner or manager."""
    if current_user.role.name not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Only owner or manager can do this")
    return current_user


def can_see_user(viewer: User, target: User) -> bool:
    """Hierarchy visibility: you see yourself + anyone strictly below your level."""
    if viewer.user_id == target.user_id:
        return True
    viewer_level = ROLE_LEVEL.get(viewer.role.name, 0)
    target_level = ROLE_LEVEL.get(target.role.name, 0)
    return viewer_level > target_level