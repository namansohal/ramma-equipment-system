from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.audit import AuditLog
from app.models.locations import Location
from app.models.users import User
from app.auth import get_current_user

router = APIRouter(prefix="/locations", tags=["Sites"])


@router.get("/")
def list_locations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [{"location_id": l.location_id, "name": l.name, "is_current": l.is_current}
            for l in db.query(Location).order_by(Location.location_id).all()]


@router.post("/{location_id}/make-current")
def make_current(location_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Owner only. The current site is shared: every ledger, report and new
    entry works on it, for every user."""
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can change the active site")
    target = db.query(Location).filter(Location.location_id == location_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Site not found")
    old = db.query(Location).filter(Location.is_current == True).first()  # noqa: E712
    if old and old.location_id == target.location_id:
        return {"message": f"{target.name} is already the active site"}
    db.query(Location).update({Location.is_current: False})
    target.is_current = True
    db.add(AuditLog(table_name="locations", record_id=target.location_id, action="UPDATE", field_name="is_current",
                    old_value=old.name if old else None, new_value=target.name, changed_by=current_user.user_id))
    db.commit()
    return {"message": f"Active site is now {target.name}"}
