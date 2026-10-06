from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.momo import MomoTransaction
from app.models.locations import Location
from app.models.audit import AuditLog
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor, require_admin
from app.text_utils import smart_capitalize, strip_tags
from app.ledger import latest_window
from app.models.links import MainbookMomoLink

LINKED_MSG = "This entry came from a Mainbook transfer. Edit or delete the Mainbook entry instead; that updates both."


def _is_linked(db: Session, momo_id: int) -> bool:
    return db.query(MainbookMomoLink).filter(MainbookMomoLink.momo_id == momo_id).first() is not None

router = APIRouter(prefix="/momo", tags=["MOMO"])


class MomoCreate(BaseModel):
    txn_date: date
    description: str
    debit: Optional[float] = 0
    credit: Optional[float] = 0
    is_carry_forward: Optional[bool] = False


class MomoEdit(BaseModel):
    txn_date: Optional[date] = None
    description: Optional[str] = None
    amount: Optional[float] = None


class BulkDelete(BaseModel):
    ids: List[int]


def _current_location(db):
    return db.query(Location).filter(Location.is_current == True).first()


def _ordered_rows(db: Session, location_id: int):
    rows = db.query(MomoTransaction).filter(
        MomoTransaction.location_id == location_id,
        MomoTransaction.deleted_at == None
    ).all()
    rows.sort(key=lambda r: (r.txn_date, 0 if r.is_carry_forward else 1, r.momo_id))
    return rows


def _recompute_balances(db: Session, location_id: int):
    db.flush()
    rows = _ordered_rows(db, location_id)
    balance = 0.0
    for r in rows:
        balance = balance + float(r.credit or 0) - float(r.debit or 0)
        r.balance = balance


@router.post("/")
def create_momo(
    data: MomoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    location = _current_location(db)
    if not location:
        raise HTTPException(status_code=400, detail="No current location set")

    debit = float(data.debit or 0)
    credit = float(data.credit or 0)
    if debit < 0 or credit < 0:
        raise HTTPException(status_code=400, detail="Amounts cannot be negative")

    txn = MomoTransaction(
        location_id=location.location_id,
        txn_date=data.txn_date,
        description=smart_capitalize(strip_tags(data.description)),
        debit=debit,
        credit=credit,
        balance=0,
        is_carry_forward=bool(data.is_carry_forward),
        created_by=current_user.user_id,
    )
    db.add(txn)
    db.flush()

    _recompute_balances(db, location.location_id)

    db.add(AuditLog(
        table_name="momo_transactions",
        record_id=txn.momo_id,
        action="CREATE",
        new_value=f"debit={debit} credit={credit} desc={data.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "MOMO entry recorded", "momo_id": txn.momo_id}


@router.get("/")
def list_momo(
    skip: int = 0,
    limit: int = 500,
    on_date: date = None,
    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    location = _current_location(db)
    if not location:
        return []

    rows = _ordered_rows(db, location.location_id)

    if on_date:
        rows = [r for r in rows if r.txn_date == on_date]
    else:
        if from_date:
            rows = [r for r in rows if r.txn_date >= from_date]
        if to_date:
            rows = [r for r in rows if r.txn_date <= to_date]

    return [
        {
            "momo_id": r.momo_id,
            "txn_date": str(r.txn_date),
            "description": r.description,
            "debit": float(r.debit or 0),
            "credit": float(r.credit or 0),
            "balance": float(r.balance or 0),
            "is_carry_forward": r.is_carry_forward,
        }
        for r in latest_window(rows, skip, limit)
    ]


@router.patch("/{momo_id}")
def edit_momo(
    momo_id: int,
    data: MomoEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    txn = db.query(MomoTransaction).filter(MomoTransaction.momo_id == momo_id, MomoTransaction.deleted_at == None).first()
    if not txn:
        raise HTTPException(status_code=404, detail="MOMO entry not found")
    if _is_linked(db, txn.momo_id):
        raise HTTPException(status_code=400, detail=LINKED_MSG)

    changes = []

    if data.txn_date is not None and data.txn_date != txn.txn_date:
        changes.append(f"date: {txn.txn_date} -> {data.txn_date}")
        txn.txn_date = data.txn_date

    if data.description is not None:
        new_desc = smart_capitalize(strip_tags(data.description))
        if new_desc != txn.description:
            changes.append(f"description: {txn.description} -> {new_desc}")
            txn.description = new_desc

    if data.amount is not None:
        if float(data.amount) < 0:
            raise HTTPException(status_code=400, detail="Amount cannot be negative")
        was_debit = float(txn.debit or 0) > 0
        old_amount = float(txn.debit) if was_debit else float(txn.credit)
        if float(data.amount) != old_amount:
            changes.append(f"amount: {old_amount} -> {data.amount}")
            if was_debit:
                txn.debit = data.amount
            else:
                txn.credit = data.amount

    if not changes:
        return {"message": "No changes made"}

    _recompute_balances(db, txn.location_id)

    db.add(AuditLog(
        table_name="momo_transactions",
        record_id=txn.momo_id,
        action="UPDATE",
        new_value="; ".join(changes),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "MOMO entry updated"}


@router.delete("/bulk")
def bulk_delete_momo(
    data: BulkDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="No entries selected")

    skipped = 0
    deleted_count = 0
    location_ids = set()

    for momo_id in data.ids:
        txn = db.query(MomoTransaction).filter(MomoTransaction.momo_id == momo_id, MomoTransaction.deleted_at == None).first()
        if not txn:
            continue
        if _is_linked(db, txn.momo_id):
            skipped += 1
            continue
        txn.deleted_at = datetime.utcnow()
        txn.deleted_by = current_user.user_id
        location_ids.add(txn.location_id)
        deleted_count += 1

        db.add(AuditLog(
            table_name="momo_transactions",
            record_id=txn.momo_id,
            action="DELETE",
            old_value=f"debit={txn.debit} credit={txn.credit} desc={txn.description}",
            changed_by=current_user.user_id,
        ))

    for loc_id in location_ids:
        _recompute_balances(db, loc_id)

    db.commit()
    msg = f"{deleted_count} entry(ies) deleted"
    if skipped:
        msg += f"; {skipped} skipped because they came from Mainbook transfers — delete those in the Mainbook"
    return {"message": msg}


@router.delete("/{momo_id}")
def delete_momo(
    momo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    txn = db.query(MomoTransaction).filter(MomoTransaction.momo_id == momo_id, MomoTransaction.deleted_at == None).first()
    if not txn:
        raise HTTPException(status_code=404, detail="MOMO entry not found")
    if _is_linked(db, txn.momo_id):
        raise HTTPException(status_code=400, detail=LINKED_MSG)

    txn.deleted_at = datetime.utcnow()
    txn.deleted_by = current_user.user_id

    _recompute_balances(db, txn.location_id)

    db.add(AuditLog(
        table_name="momo_transactions",
        record_id=txn.momo_id,
        action="DELETE",
        old_value=f"debit={txn.debit} credit={txn.credit} desc={txn.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "MOMO entry deleted", "deleted_by": current_user.full_name}