from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.mainbook import MainbookTransaction
from app.models.expenses import Expense, ExpenseType
from app.models.locations import Location
from app.models.links import MainbookExpenseLink
from app.models.machine_income import MachineIncome
from app.models.audit import AuditLog
from app.schemas.mainbook import MainbookResponse
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor, require_admin
from app.text_utils import smart_capitalize

router = APIRouter(prefix="/mainbook", tags=["Mainbook"])


class MainbookCreate(BaseModel):
    txn_date: date
    description: str
    debit: Optional[float] = 0
    credit: Optional[float] = 0
    destination: Optional[str] = None
    machine_id: Optional[int] = None
    is_carry_forward: Optional[bool] = False


class MainbookEdit(BaseModel):
    txn_date: Optional[date] = None
    description: Optional[str] = None
    amount: Optional[float] = None


class BulkDelete(BaseModel):
    ids: List[int]


def _current_location(db):
    return db.query(Location).filter(Location.is_current == True).first()


def _ordered_rows(db: Session, location_id: int):
    rows = db.query(MainbookTransaction).filter(
        MainbookTransaction.location_id == location_id,
        MainbookTransaction.deleted_at == None
    ).all()
    rows.sort(key=lambda r: (r.txn_date, 0 if r.is_carry_forward else 1, r.transaction_id))
    return rows


def _recompute_mainbook_balances(db: Session, location_id: int):
    db.flush()
    rows = _ordered_rows(db, location_id)
    balance = 0.0
    for r in rows:
        balance = balance + float(r.credit or 0) - float(r.debit or 0)
        r.balance = balance


def _recompute_expense_balances(db: Session, location_id: int):
    rows = db.query(Expense).filter(
        Expense.location_id == location_id,
        Expense.deleted_at == None
    ).order_by(Expense.expense_id).all()
    balance = 0.0
    for r in rows:
        balance = balance + float(r.credit or 0) - float(r.debit or 0)
        r.balance = balance


def _delete_linked_expense(db: Session, transaction_id: int, deleted_by: int):
    """When a Mainbook entry is deleted, also soft-delete its linked Expense row."""
    link = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.transaction_id == transaction_id).first()
    if link:
        exp = db.query(Expense).filter(Expense.expense_id == link.expense_id, Expense.deleted_at == None).first()
        if exp:
            exp.deleted_at = datetime.utcnow()
            exp.deleted_by = deleted_by
            db.add(AuditLog(
                table_name="expenses",
                record_id=exp.expense_id,
                action="DELETE",
                old_value=f"auto-deleted: linked mainbook entry {transaction_id} was deleted",
                changed_by=deleted_by,
            ))
            db.flush()
            _recompute_expense_balances(db, exp.location_id)


@router.post("/", response_model=MainbookResponse)
def create_transaction(
    data: MainbookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    location = _current_location(db)
    if not location:
        raise HTTPException(status_code=400, detail="No current location set")

    debit = float(data.debit or 0)
    credit = float(data.credit or 0)

    if debit > 0 and not data.destination:
        raise HTTPException(status_code=400, detail="Select where the money is going (Expense / Refund / MOMO)")
    if data.destination and data.destination not in ("expense", "refund", "momo"):
        raise HTTPException(status_code=400, detail="Invalid destination")

    clean_description = smart_capitalize(data.description)

    desc = clean_description
    if debit > 0 and data.destination:
        desc = f"{clean_description} [{data.destination.upper()}]"
    if data.machine_id and credit > 0:
        desc = f"{clean_description} [MACHINE INCOME]"

    txn = MainbookTransaction(
        location_id=location.location_id,
        txn_date=data.txn_date,
        description=desc,
        debit=debit,
        credit=credit,
        balance=0,
        is_carry_forward=bool(data.is_carry_forward),
        created_by=current_user.user_id,
    )
    db.add(txn)
    db.flush()

    if debit > 0 and data.destination == "expense":
        last_exp = db.query(Expense).filter(
            Expense.location_id == location.location_id,
            Expense.deleted_at == None
        ).order_by(Expense.expense_id.desc()).first()
        exp_last_balance = last_exp.balance if last_exp else 0
        exp_new_balance = float(exp_last_balance) + debit

        cash_type = db.query(ExpenseType).filter(ExpenseType.code == "cash_receipt").first()

        exp = Expense(
            location_id=location.location_id,
            expense_type_id=cash_type.type_id if cash_type else 1,
            txn_date=data.txn_date,
            description=f"Cash from Mainbook: {clean_description}",
            debit=0,
            credit=debit,
            balance=exp_new_balance,
            is_common=False,
            created_by=current_user.user_id,
        )
        db.add(exp)
        db.flush()
        db.add(MainbookExpenseLink(transaction_id=txn.transaction_id, expense_id=exp.expense_id))

    if credit > 0 and data.machine_id:
        db.add(MachineIncome(
            machine_id=data.machine_id,
            transaction_id=txn.transaction_id,
            amount=credit,
            txn_date=data.txn_date,
        ))

    _recompute_mainbook_balances(db, location.location_id)

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="CREATE",
        new_value=f"debit={debit} credit={credit} dest={data.destination or '-'} machine={data.machine_id or '-'} carry_forward={data.is_carry_forward} desc={data.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/", response_model=List[MainbookResponse])
def list_transactions(
    skip: int = 0,
    limit: int = 500,
    on_date: date = None,
    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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

    return rows[skip: skip + limit]


@router.patch("/{transaction_id}")
def edit_transaction(
    transaction_id: int,
    data: MainbookEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    txn = db.query(MainbookTransaction).filter(
        MainbookTransaction.transaction_id == transaction_id,
        MainbookTransaction.deleted_at == None
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    is_expense_linked = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.transaction_id == transaction_id).first()
    is_income_linked = db.query(MachineIncome).filter(MachineIncome.transaction_id == transaction_id).first()
    if is_expense_linked or is_income_linked:
        raise HTTPException(
            status_code=400,
            detail="This entry is linked to the Expense book or a machine's income and cannot be edited directly. Delete and re-enter instead."
        )

    changes = []

    if data.txn_date is not None and data.txn_date != txn.txn_date:
        changes.append(f"date: {txn.txn_date} -> {data.txn_date}")
        txn.txn_date = data.txn_date

    if data.description is not None:
        new_desc = smart_capitalize(data.description)
        if new_desc != txn.description:
            changes.append(f"description: {txn.description} -> {new_desc}")
            txn.description = new_desc

    if data.amount is not None:
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

    _recompute_mainbook_balances(db, txn.location_id)

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="UPDATE",
        new_value="; ".join(changes),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Entry updated"}


@router.delete("/bulk")
def bulk_delete_transactions(
    data: BulkDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="No entries selected")

    deleted_count = 0
    location_ids = set()

    for transaction_id in data.ids:
        txn = db.query(MainbookTransaction).filter(
            MainbookTransaction.transaction_id == transaction_id,
            MainbookTransaction.deleted_at == None
        ).first()
        if not txn:
            continue

        txn.deleted_at = datetime.utcnow()
        txn.deleted_by = current_user.user_id
        location_ids.add(txn.location_id)
        deleted_count += 1

        db.query(MachineIncome).filter(MachineIncome.transaction_id == transaction_id).delete()
        _delete_linked_expense(db, transaction_id, current_user.user_id)

        db.add(AuditLog(
            table_name="mainbook_transactions",
            record_id=txn.transaction_id,
            action="DELETE",
            old_value=f"debit={txn.debit} credit={txn.credit} desc={txn.description}",
            changed_by=current_user.user_id,
        ))

    for loc_id in location_ids:
        _recompute_mainbook_balances(db, loc_id)

    db.commit()
    return {"message": f"{deleted_count} entry(ies) deleted"}


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    txn = db.query(MainbookTransaction).filter(
        MainbookTransaction.transaction_id == transaction_id,
        MainbookTransaction.deleted_at == None
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn.deleted_at = datetime.utcnow()
    txn.deleted_by = current_user.user_id

    db.query(MachineIncome).filter(MachineIncome.transaction_id == transaction_id).delete()
    _delete_linked_expense(db, transaction_id, current_user.user_id)

    _recompute_mainbook_balances(db, txn.location_id)

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="DELETE",
        old_value=f"debit={txn.debit} credit={txn.credit} desc={txn.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Entry deleted", "deleted_by": current_user.full_name}