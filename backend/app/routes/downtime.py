from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.database import get_db
from app.models.downtime import MachineDowntime
from app.models.machines import Machine
from app.models.audit import AuditLog
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor

router = APIRouter(prefix="/downtime", tags=["Downtime"])


class DowntimeCreate(BaseModel):
    machine_id: int
    start_date: date
    end_date: Optional[date] = None
    reason: str
    notes: Optional[str] = None


class DowntimeEnd(BaseModel):
    end_date: date


@router.post("/")
def create_downtime(
    data: DowntimeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    machine = db.query(Machine).filter(Machine.machine_id == data.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    if data.end_date and data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    existing_open = db.query(MachineDowntime).filter(
        MachineDowntime.machine_id == data.machine_id,
        MachineDowntime.end_date == None,
        MachineDowntime.deleted_at == None
    ).first()
    if existing_open and not data.end_date:
        raise HTTPException(
            status_code=400,
            detail=f"{machine.code} already has an ongoing downtime record. Resolve it first."
        )

    dt = MachineDowntime(
        machine_id=data.machine_id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        notes=data.notes,
        created_by=current_user.user_id,
    )
    db.add(dt)
    db.flush()

    db.add(AuditLog(
        table_name="machine_downtime",
        record_id=dt.downtime_id,
        action="CREATE",
        new_value=f"machine={data.machine_id} reason={data.reason}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"downtime_id": dt.downtime_id, "message": "Downtime recorded"}


@router.patch("/{downtime_id}/end")
def end_downtime(
    downtime_id: int,
    data: DowntimeEnd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    dt = db.query(MachineDowntime).filter(
        MachineDowntime.downtime_id == downtime_id,
        MachineDowntime.deleted_at == None
    ).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Downtime record not found")

    if dt.end_date is not None:
        raise HTTPException(status_code=400, detail="This downtime has already been resolved")

    if data.end_date < dt.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    dt.end_date = data.end_date

    db.add(AuditLog(
        table_name="machine_downtime",
        record_id=dt.downtime_id,
        action="UPDATE",
        field_name="end_date",
        new_value=str(data.end_date),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Downtime marked as resolved"}


@router.get("/")
def list_downtime(
    machine_id: Optional[int] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    limit = min(limit, 500)

    query = db.query(MachineDowntime).filter(MachineDowntime.deleted_at == None)
    if machine_id:
        query = query.filter(MachineDowntime.machine_id == machine_id)

    records = query.order_by(MachineDowntime.start_date.desc()).limit(limit).all()
    machines = {m.machine_id: m.code for m in db.query(Machine).all()}

    result = []
    for r in records:
        if r.end_date:
            days = (r.end_date - r.start_date).days + 1
        else:
            days = (date.today() - r.start_date).days + 1
        result.append({
            "downtime_id": r.downtime_id,
            "machine_id": r.machine_id,
            "machine_code": machines.get(r.machine_id),
            "start_date": str(r.start_date),
            "end_date": str(r.end_date) if r.end_date else None,
            "reason": r.reason,
            "notes": r.notes,
            "days": days,
            "ongoing": r.end_date is None,
        })
    return result