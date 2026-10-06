from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, timezone
from pydantic import BaseModel
from app.database import get_db
from app.models.staff import Staff
from app.models.users import User
from app.models.audit import AuditLog
from app.auth import get_current_user
from app.permissions import require_admin

router = APIRouter(prefix="/staff", tags=["Staff"])


class StaffCreate(BaseModel):
    full_name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    monthly_salary: Optional[float] = None
    currency: str = "GHS"
    join_date: Optional[date] = None


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    monthly_salary: Optional[float] = None
    currency: Optional[str] = None
    join_date: Optional[date] = None


@router.get("/")
def list_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    staff = db.query(Staff).filter(Staff.deleted_at == None, Staff.active == True).order_by(Staff.full_name).all()
    return [
        {
            "staff_id": s.staff_id,
            "full_name": s.full_name,
            "designation": s.designation,
            "department": s.department,
            "monthly_salary": float(s.monthly_salary) if s.monthly_salary is not None else None,
            "currency": s.currency,
            "join_date": str(s.join_date) if s.join_date else None,
        }
        for s in staff
    ]


@router.post("/")
def create_staff(
    data: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if data.currency not in ("GHS", "INR"):
        raise HTTPException(status_code=400, detail="Currency must be GHS or INR")
    if not (data.full_name or "").strip():
        raise HTTPException(status_code=400, detail="Enter the staff member's name")
    if data.monthly_salary is not None and data.monthly_salary < 0:
        raise HTTPException(status_code=400, detail="Salary cannot be negative")

    s = Staff(
        full_name=data.full_name.strip(),
        designation=data.designation,
        department=data.department,
        monthly_salary=data.monthly_salary,
        currency=data.currency,
        join_date=data.join_date,
        created_by=current_user.user_id,
    )
    db.add(s)
    db.flush()

    db.add(AuditLog(
        table_name="staff", record_id=s.staff_id, action="CREATE",
        new_value=f"{data.full_name} ({data.currency} {data.monthly_salary})",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"Staff member {data.full_name} added"}


@router.patch("/{staff_id}")
def update_staff(
    staff_id: int,
    data: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    s = db.query(Staff).filter(Staff.staff_id == staff_id, Staff.deleted_at == None).first()
    if not s:
        raise HTTPException(status_code=404, detail="Staff not found")

    if data.full_name is not None:
        data.full_name = data.full_name.strip()
        if not data.full_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
    if data.currency is not None and data.currency not in ("GHS", "INR"):
        raise HTTPException(status_code=400, detail="Currency must be GHS or INR")
    if data.monthly_salary is not None and data.monthly_salary < 0:
        raise HTTPException(status_code=400, detail="Salary cannot be negative")

    changes = []
    for field in ["full_name", "designation", "department", "monthly_salary", "currency", "join_date"]:
        val = getattr(data, field)
        if val is not None:
            old = getattr(s, field)
            if str(old) != str(val):
                setattr(s, field, val)
                changes.append(f"{field}: {old} -> {val}")

    if changes:
        db.add(AuditLog(
            table_name="staff", record_id=s.staff_id, action="UPDATE",
            new_value="; ".join(changes), changed_by=current_user.user_id,
        ))
    db.commit()
    return {"message": "Staff updated"}


@router.delete("/{staff_id}")
def remove_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    s = db.query(Staff).filter(Staff.staff_id == staff_id, Staff.deleted_at == None).first()
    if not s:
        raise HTTPException(status_code=404, detail="Staff not found")

    s.active = False
    s.deleted_at = datetime.now(timezone.utc)
    s.deleted_by = current_user.user_id

    db.add(AuditLog(
        table_name="staff", record_id=s.staff_id, action="DELETE",
        old_value=s.full_name, changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"{s.full_name} removed from staff"}