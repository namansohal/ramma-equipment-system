from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
from app.models.alerts import Alert
from app.models.users import User
from app.auth import get_current_user
from app.permissions import ROLE_LEVEL

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/")
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alerts = db.query(Alert).filter(
        Alert.for_user_id == current_user.user_id,
        Alert.deleted_at == None
    ).order_by(Alert.created_at.desc()).limit(100).all()

    return [
        {
            "alert_id": a.alert_id,
            "type": a.alert_type,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "is_read": a.is_read,
        }
        for a in alerts
    ]


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = db.query(Alert).filter(
        Alert.for_user_id == current_user.user_id,
        Alert.deleted_at == None,
        Alert.is_read == False
    ).count()
    return {"count": count}


@router.post("/{alert_id}/read")
def mark_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id, Alert.for_user_id == current_user.user_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"message": "Marked read"}


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id, Alert.deleted_at == None).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Only owner/manager can delete alerts, and only for people at or below their level
    if current_user.role.name not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Only owner or manager can delete alerts")

    target_user = db.query(User).filter(User.user_id == alert.for_user_id).first()
    if target_user:
        viewer_level = ROLE_LEVEL.get(current_user.role.name, 0)
        target_level = ROLE_LEVEL.get(target_user.role.name, 0)
        if current_user.user_id != target_user.user_id and viewer_level <= target_level:
            raise HTTPException(status_code=403, detail="You cannot delete alerts belonging to this user")

    alert.deleted_at = datetime.now(timezone.utc)
    alert.deleted_by = current_user.user_id
    db.commit()
    return {"message": "Alert deleted"}