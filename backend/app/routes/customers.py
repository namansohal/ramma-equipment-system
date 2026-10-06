from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.audit import AuditLog
from app.models.customers import CustomerPayment
from app.models.machines import Machine
from app.models.runtime import MachineRuntime
from app.models.users import User
from app.permissions import require_admin

router = APIRouter(prefix="/customers", tags=["Customers"])

METHODS = ("cash", "momo", "bank", "cheque", "other")


def customer_key(name: Optional[str]) -> str:
    """'  Asante  Construction ' and 'asante construction' are the same customer."""
    return " ".join((name or "").split()).lower()


class PaymentCreate(BaseModel):
    customer_name: str
    amount: float
    txn_date: date
    method: Optional[str] = "cash"
    notes: Optional[str] = None


def _live_runtime(db: Session):
    return db.query(MachineRuntime).filter(
        MachineRuntime.deleted_at == None,
        MachineRuntime.customer_name != None,
    ).all()


def _live_payments(db: Session, key: Optional[str] = None):
    q = db.query(CustomerPayment).filter(CustomerPayment.deleted_at == None)
    if key is not None:
        q = q.filter(CustomerPayment.customer_key == key)
    return q.all()


@router.get("/")
def list_customers(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    customers = {}

    def entry(key, name, when):
        c = customers.setdefault(key, {"key": key, "name": name, "billed": 0.0, "paid": 0.0,
                                       "hours": 0.0, "jobs": 0, "last_date": None, "_name_date": None})
        # Show the most recently used spelling of the name.
        if c["_name_date"] is None or when >= c["_name_date"]:
            c["name"], c["_name_date"] = name, when
        if c["last_date"] is None or when > c["last_date"]:
            c["last_date"] = when
        return c

    for r in _live_runtime(db):
        key = customer_key(r.customer_name)
        if not key:
            continue
        c = entry(key, " ".join(r.customer_name.split()), r.txn_date)
        c["billed"] += float(r.amount or 0)
        c["jobs"] += 1
        if r.start_reading is not None and r.end_reading is not None and r.end_reading >= r.start_reading:
            c["hours"] += float(r.end_reading - r.start_reading)

    for p in _live_payments(db):
        c = entry(p.customer_key, p.customer_name, p.txn_date)
        c["paid"] += float(p.amount or 0)

    out = []
    for c in customers.values():
        c.pop("_name_date")
        c["owed"] = round(c["billed"] - c["paid"], 2)
        c["billed"], c["paid"], c["hours"] = round(c["billed"], 2), round(c["paid"], 2), round(c["hours"], 2)
        c["last_date"] = str(c["last_date"]) if c["last_date"] else None
        out.append(c)
    out.sort(key=lambda c: (-c["owed"], c["name"].lower()))
    return out


@router.get("/detail")
def customer_detail(key: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    key = customer_key(key)
    machines = {m.machine_id: m.code for m in db.query(Machine).all()}
    jobs = [r for r in _live_runtime(db) if customer_key(r.customer_name) == key]
    payments = _live_payments(db, key)
    if not jobs and not payments:
        raise HTTPException(status_code=404, detail="Customer not found")

    names = sorted([(r.txn_date, r.customer_name) for r in jobs] + [(p.txn_date, p.customer_name) for p in payments])
    lines = [{
        "kind": "job", "id": r.runtime_id, "date": str(r.txn_date), "machine": machines.get(r.machine_id),
        "hours": float(r.end_reading - r.start_reading) if r.start_reading is not None and r.end_reading is not None and r.end_reading >= r.start_reading else None,
        "description": r.status_note or "", "billed": float(r.amount or 0), "paid": 0.0,
    } for r in jobs] + [{
        "kind": "payment", "id": p.payment_id, "date": str(p.txn_date), "machine": None, "hours": None,
        "description": f"Payment ({p.method or 'cash'})" + (f" — {p.notes}" if p.notes else ""),
        "billed": 0.0, "paid": float(p.amount or 0),
    } for p in payments]
    # Jobs before payments on the same day, then a running "owed" balance.
    lines.sort(key=lambda l: (l["date"], 0 if l["kind"] == "job" else 1, l["id"]))
    owed = 0.0
    for l in lines:
        owed += l["billed"] - l["paid"]
        l["owed"] = round(owed, 2)

    billed = sum(l["billed"] for l in lines)
    paid = sum(l["paid"] for l in lines)
    return {
        "key": key,
        "name": " ".join(names[-1][1].split()),
        "billed": round(billed, 2),
        "paid": round(paid, 2),
        "owed": round(billed - paid, 2),
        "lines": lines,
    }


@router.post("/payments")
def record_payment(data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    name = " ".join((data.customer_name or "").split())
    if not name:
        raise HTTPException(status_code=400, detail="Customer name is required")
    if not data.amount or data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than zero")
    method = (data.method or "cash").lower()
    if method not in METHODS:
        raise HTTPException(status_code=400, detail="Invalid payment method")

    p = CustomerPayment(
        customer_key=customer_key(name), customer_name=name, txn_date=data.txn_date,
        amount=data.amount, method=method, notes=(data.notes or "").strip() or None,
        created_by=current_user.user_id,
    )
    db.add(p)
    db.flush()
    db.add(AuditLog(table_name="customer_payments", record_id=p.payment_id, action="CREATE",
                    new_value=f"customer={name} amount={data.amount} method={method}",
                    changed_by=current_user.user_id))
    db.commit()
    return {"message": "Payment recorded", "payment_id": p.payment_id}


@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    p = db.query(CustomerPayment).filter(CustomerPayment.payment_id == payment_id, CustomerPayment.deleted_at == None).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    p.deleted_at = datetime.utcnow()
    p.deleted_by = current_user.user_id
    db.add(AuditLog(table_name="customer_payments", record_id=p.payment_id, action="DELETE",
                    old_value=f"customer={p.customer_name} amount={p.amount}", changed_by=current_user.user_id))
    db.commit()
    return {"message": "Payment deleted"}
