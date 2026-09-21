from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.runtime import MachineRuntime
from app.models.machines import Machine
from app.models.audit import AuditLog
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_admin

router = APIRouter(prefix="/runtime", tags=["Runtime"])


class RuntimeCreate(BaseModel):
    machine_id: int
    customer_name: Optional[str] = None
    txn_date: date
    start_reading: Optional[float] = None
    end_reading: Optional[float] = None
    amount: float
    status_note: Optional[str] = None


class RuntimeEdit(BaseModel):
    customer_name: Optional[str] = None
    txn_date: Optional[date] = None
    start_reading: Optional[float] = None
    end_reading: Optional[float] = None
    amount: Optional[float] = None
    status_note: Optional[str] = None


@router.post("/")
def create_runtime(
    data: RuntimeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    machine = db.query(Machine).filter(Machine.machine_id == data.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    if data.amount < 0:
        raise HTTPException(status_code=400, detail="Amount cannot be negative")

    if data.start_reading is not None and data.end_reading is not None:
        if data.end_reading < data.start_reading:
            raise HTTPException(status_code=400, detail="Closing reading cannot be less than starting reading")

    entry = MachineRuntime(
        machine_id=data.machine_id,
        customer_name=data.customer_name,
        txn_date=data.txn_date,
        start_reading=data.start_reading,
        end_reading=data.end_reading,
        amount=data.amount,
        status_note=data.status_note,
        created_by=current_user.user_id,
    )
    db.add(entry)
    db.flush()

    db.add(AuditLog(
        table_name="machine_runtime",
        record_id=entry.runtime_id,
        action="CREATE",
        new_value=f"machine={data.machine_id} amount={data.amount} customer={data.customer_name}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Runtime entry recorded", "runtime_id": entry.runtime_id}


@router.get("/")
def list_runtime(
    machine_id: Optional[int] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    limit = min(limit, 500)
    query = db.query(MachineRuntime).filter(MachineRuntime.deleted_at == None)
    if machine_id:
        query = query.filter(MachineRuntime.machine_id == machine_id)

    rows = query.order_by(MachineRuntime.txn_date.desc(), MachineRuntime.runtime_id.desc()).limit(limit).all()
    machines = {m.machine_id: m.code for m in db.query(Machine).all()}

    return [
        {
            "runtime_id": r.runtime_id,
            "machine_id": r.machine_id,
            "machine_code": machines.get(r.machine_id),
            "customer_name": r.customer_name,
            "txn_date": str(r.txn_date),
            "start_reading": float(r.start_reading) if r.start_reading is not None else None,
            "end_reading": float(r.end_reading) if r.end_reading is not None else None,
            "hours": (float(r.end_reading) - float(r.start_reading)) if (r.start_reading is not None and r.end_reading is not None) else None,
            "amount": float(r.amount),
            "status_note": r.status_note,
        }
        for r in rows
    ]


@router.patch("/{runtime_id}")
def edit_runtime(
    runtime_id: int,
    data: RuntimeEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    entry = db.query(MachineRuntime).filter(MachineRuntime.runtime_id == runtime_id, MachineRuntime.deleted_at == None).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Runtime entry not found")

    changes = []
    if data.customer_name is not None and data.customer_name != entry.customer_name:
        changes.append(f"customer: {entry.customer_name} -> {data.customer_name}")
        entry.customer_name = data.customer_name
    if data.txn_date is not None and data.txn_date != entry.txn_date:
        changes.append(f"date: {entry.txn_date} -> {data.txn_date}")
        entry.txn_date = data.txn_date
    if data.start_reading is not None and float(data.start_reading) != float(entry.start_reading or 0):
        changes.append(f"start: {entry.start_reading} -> {data.start_reading}")
        entry.start_reading = data.start_reading
    if data.end_reading is not None and float(data.end_reading) != float(entry.end_reading or 0):
        changes.append(f"end: {entry.end_reading} -> {data.end_reading}")
        entry.end_reading = data.end_reading
    if data.amount is not None:
        if data.amount < 0:
            raise HTTPException(status_code=400, detail="Amount cannot be negative")
        if float(data.amount) != float(entry.amount):
            changes.append(f"amount: {entry.amount} -> {data.amount}")
            entry.amount = data.amount
    if data.status_note is not None and data.status_note != entry.status_note:
        changes.append(f"note: {entry.status_note} -> {data.status_note}")
        entry.status_note = data.status_note

    if not changes:
        return {"message": "No changes made"}

    db.add(AuditLog(
        table_name="machine_runtime",
        record_id=entry.runtime_id,
        action="UPDATE",
        new_value="; ".join(changes),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Runtime entry updated"}


@router.delete("/{runtime_id}")
def delete_runtime(
    runtime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    entry = db.query(MachineRuntime).filter(MachineRuntime.runtime_id == runtime_id, MachineRuntime.deleted_at == None).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Runtime entry not found")

    entry.deleted_at = datetime.utcnow()
    entry.deleted_by = current_user.user_id

    db.add(AuditLog(
        table_name="machine_runtime",
        record_id=entry.runtime_id,
        action="DELETE",
        old_value=f"amount={entry.amount} machine={entry.machine_id}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Runtime entry deleted"}