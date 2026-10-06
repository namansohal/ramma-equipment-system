from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timezone
from pydantic import BaseModel
from app.database import get_db
from app.models.mainbook import MainbookTransaction
from app.models.expenses import Expense, ExpenseType
from app.models.locations import Location
from app.models.links import MainbookExpenseLink, MainbookMomoLink
from app.models.momo import MomoTransaction
from app.models.machine_income import MachineIncome
from app.models.audit import AuditLog
from app.schemas.mainbook import MainbookResponse
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor, require_admin
from app.text_utils import smart_capitalize
from app.ledger import recompute_expense_balances, latest_window

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


class BulkDateChange(BaseModel):
    ids: List[int]
    new_date: date


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
    # Same ledger order as the Expenses page (by date), not entry order.
    recompute_expense_balances(db, location_id)


def _delete_linked_expense(db: Session, transaction_id: int, deleted_by: int):
    link = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.transaction_id == transaction_id).first()
    if link:
        exp = db.query(Expense).filter(Expense.expense_id == link.expense_id, Expense.deleted_at == None).first()
        if exp:
            exp.deleted_at = datetime.now(timezone.utc)
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


def _recompute_momo(db: Session, location_id: int):
    from app.routes.momo import _recompute_balances
    _recompute_balances(db, location_id)


def _linked_momo(db: Session, transaction_id: int):
    link = db.query(MainbookMomoLink).filter(MainbookMomoLink.transaction_id == transaction_id).first()
    return link and db.query(MomoTransaction).filter(MomoTransaction.momo_id == link.momo_id).first()


def _delete_linked_momo(db: Session, transaction_id: int, deleted_by: int):
    m = _linked_momo(db, transaction_id)
    if m and m.deleted_at is None:
        m.deleted_at = datetime.now(timezone.utc)
        m.deleted_by = deleted_by
        db.add(AuditLog(table_name="momo_transactions", record_id=m.momo_id, action="DELETE",
                        old_value=f"auto-deleted: linked mainbook entry {transaction_id} was deleted",
                        changed_by=deleted_by))
        _recompute_momo(db, m.location_id)


def _remove_machine_income(db: Session, transaction_id: int, deleted_by: int):
    """Machine income rows have no soft-delete column, so log each one before
    removing it; restoring the mainbook entry re-creates them from this log."""
    for inc in db.query(MachineIncome).filter(MachineIncome.transaction_id == transaction_id).all():
        db.add(AuditLog(
            table_name="machine_income",
            record_id=transaction_id,
            action="DELETE",
            old_value=f"machine_id={inc.machine_id} amount={inc.amount} txn_date={inc.txn_date}",
            changed_by=deleted_by,
        ))
        db.delete(inc)


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
    if debit < 0 or credit < 0:
        raise HTTPException(status_code=400, detail="Amounts cannot be negative")
    if debit == 0 and credit == 0 and not data.is_carry_forward:
        raise HTTPException(status_code=400, detail="Enter an amount")

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
        # The expense's running balance depends on its date; rebuild the book.
        _recompute_expense_balances(db, location.location_id)

    if debit > 0 and data.destination == "momo":
        # Money sent to MOMO shows up there as money in, linked to this entry.
        m = MomoTransaction(
            location_id=location.location_id,
            txn_date=data.txn_date,
            description=f"From Mainbook: {clean_description}",
            debit=0,
            credit=debit,
            balance=0,
            is_carry_forward=False,
            created_by=current_user.user_id,
        )
        db.add(m)
        db.flush()
        db.add(MainbookMomoLink(transaction_id=txn.transaction_id, momo_id=m.momo_id))
        _recompute_momo(db, location.location_id)

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

    return latest_window(rows, skip, limit)


@router.patch("/bulk-date")
def bulk_change_date(
    data: BulkDateChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="No entries selected")

    changed = 0
    location_ids = set()
    expense_location_ids = set()
    momo_location_ids = set()

    for transaction_id in data.ids:
        txn = db.query(MainbookTransaction).filter(
            MainbookTransaction.transaction_id == transaction_id,
            MainbookTransaction.deleted_at == None
        ).first()
        if not txn:
            continue
        old_date = txn.txn_date
        txn.txn_date = data.new_date
        location_ids.add(txn.location_id)
        changed += 1

        # Move the linked Expense entry's date too, so the two books stay in sync
        link = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.transaction_id == transaction_id).first()
        if link:
            exp = db.query(Expense).filter(Expense.expense_id == link.expense_id, Expense.deleted_at == None).first()
            if exp:
                exp.txn_date = data.new_date
                expense_location_ids.add(exp.location_id)

        m = _linked_momo(db, transaction_id)
        if m and m.deleted_at is None:
            m.txn_date = data.new_date
            momo_location_ids.add(m.location_id)

        # Move linked machine income date too
        db.query(MachineIncome).filter(MachineIncome.transaction_id == transaction_id).update({"txn_date": data.new_date})

        db.add(AuditLog(
            table_name="mainbook_transactions",
            record_id=txn.transaction_id,
            action="UPDATE",
            new_value=f"date: {old_date} -> {data.new_date} (bulk)",
            changed_by=current_user.user_id,
        ))

    for loc_id in location_ids:
        _recompute_mainbook_balances(db, loc_id)
    for loc_id in expense_location_ids:
        _recompute_expense_balances(db, loc_id)
    for loc_id in momo_location_ids:
        _recompute_momo(db, loc_id)

    db.commit()
    return {"message": f"{changed} entry(ies) moved to {data.new_date}"}


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
    is_momo_linked = db.query(MainbookMomoLink).filter(MainbookMomoLink.transaction_id == transaction_id).first()
    if is_expense_linked or is_income_linked or is_momo_linked:
        raise HTTPException(
            status_code=400,
            detail="This entry is linked to the Expense book, MOMO or a machine's income and cannot be edited directly. Delete and re-enter instead."
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
    current_user: User = Depends(require_admin)
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

        txn.deleted_at = datetime.now(timezone.utc)
        txn.deleted_by = current_user.user_id
        location_ids.add(txn.location_id)
        deleted_count += 1

        _remove_machine_income(db, transaction_id, current_user.user_id)
        _delete_linked_expense(db, transaction_id, current_user.user_id)
        _delete_linked_momo(db, transaction_id, current_user.user_id)

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

    txn.deleted_at = datetime.now(timezone.utc)
    txn.deleted_by = current_user.user_id

    _remove_machine_income(db, transaction_id, current_user.user_id)
    _delete_linked_expense(db, transaction_id, current_user.user_id)
    _delete_linked_momo(db, transaction_id, current_user.user_id)

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