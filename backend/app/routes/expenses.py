from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.expenses import Expense, ExpenseMachineLink, ExpenseType
from app.models.locations import Location
from app.models.machines import Machine
from app.models.loans import Loan, LoanRepayment
from app.models.links import ExpenseStockLink, MainbookExpenseLink
from app.models.audit import AuditLog
from app.schemas.expenses import ExpenseCreate, ExpenseEdit, ExpenseResponse
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_admin, require_editor
from app.text_utils import smart_capitalize
from app.ledger import ordered_expense_rows, recompute_expense_balances, latest_window
from app.expense_links import delete_blocked_reason, delete_linked

router = APIRouter(prefix="/expenses", tags=["Expenses"])


class BulkDelete(BaseModel):
    ids: List[int]


class BulkDateChange(BaseModel):
    ids: List[int]
    new_date: date


def _ordered_expense_rows(db: Session, location_id: int):
    return ordered_expense_rows(db, location_id)


def _recompute_expense_balances(db: Session, location_id: int):
    recompute_expense_balances(db, location_id)


@router.post("/", response_model=ExpenseResponse)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    location = db.query(Location).filter(Location.is_current == True).first()
    if not location:
        raise HTTPException(status_code=400, detail="No current location set")

    expense_type = db.query(ExpenseType).filter(ExpenseType.type_id == data.expense_type_id).first()
    if not expense_type:
        raise HTTPException(status_code=404, detail="Expense type not found")

    debit, credit = float(data.debit or 0), float(data.credit or 0)
    if debit < 0 or credit < 0:
        raise HTTPException(status_code=400, detail="Amounts cannot be negative")
    if debit == 0 and credit == 0 and not data.is_carry_forward:
        raise HTTPException(status_code=400, detail="Enter an amount")

    machine_ids = list(dict.fromkeys(data.machine_ids or []))
    if machine_ids:
        known = {m for (m,) in db.query(Machine.machine_id).filter(Machine.machine_id.in_(machine_ids)).all()}
        unknown = [m for m in machine_ids if m not in known]
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown machine id(s): {', '.join(map(str, unknown))}")

    if expense_type.code == "loan":
        if not data.staff_id:
            raise HTTPException(status_code=400, detail="Select which staff member this loan is for")
        from app.routes.loans import create_loan_with_expense
        loan = create_loan_with_expense(
            db, data.staff_id, float(data.debit or 0), data.txn_date, data.description, current_user
        )
        _recompute_expense_balances(db, location.location_id)
        db.commit()
        expense = db.query(Expense).filter(Expense.expense_id == loan.expense_id).first()
        return expense

    is_common = len(machine_ids) == 0

    expense = Expense(
        location_id=location.location_id,
        expense_type_id=data.expense_type_id,
        txn_date=data.txn_date,
        description=smart_capitalize(data.description),
        debit=data.debit,
        credit=data.credit,
        balance=0,
        is_common=is_common,
        is_carry_forward=bool(getattr(data, "is_carry_forward", False)),
        created_by=current_user.user_id,
    )
    db.add(expense)
    db.flush()

    for machine_id in machine_ids:
        db.add(ExpenseMachineLink(expense_id=expense.expense_id, machine_id=machine_id))

    _recompute_expense_balances(db, location.location_id)

    db.add(AuditLog(
        table_name="expenses",
        record_id=expense.expense_id,
        action="CREATE",
        new_value=f"debit={data.debit} credit={data.credit} desc={data.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/", response_model=List[ExpenseResponse])
def get_expenses(
    skip: int = 0,
    limit: int = 100,
    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    limit = min(limit, 500)

    location = db.query(Location).filter(Location.is_current == True).first()
    if not location:
        return []

    # Filter dates in the database so a date-ranged request (e.g. the dashboard's
    # "today") doesn't load every expense ever recorded.
    query = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at == None
    )
    if from_date:
        query = query.filter(Expense.txn_date >= from_date)
    if to_date:
        query = query.filter(Expense.txn_date <= to_date)
    rows = query.all()
    rows.sort(key=lambda r: (r.txn_date, 0 if r.is_carry_forward else 1, r.expense_id))

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
    skipped = 0
    location_ids = set()

    for expense_id in data.ids:
        expense = db.query(Expense).filter(Expense.expense_id == expense_id, Expense.deleted_at == None).first()
        if not expense:
            continue
        # Linked entries would drift from their purchase / Mainbook entry / loan.
        if (db.query(ExpenseStockLink).filter(ExpenseStockLink.expense_id == expense_id).first()
                or db.query(MainbookExpenseLink).filter(MainbookExpenseLink.expense_id == expense_id).first()
                or db.query(Loan).filter(Loan.expense_id == expense_id).first()
                or db.query(LoanRepayment).filter(LoanRepayment.expense_id == expense_id).first()):
            skipped += 1
            continue
        old_date = expense.txn_date
        expense.txn_date = data.new_date
        location_ids.add(expense.location_id)
        changed += 1

        db.add(AuditLog(
            table_name="expenses",
            record_id=expense.expense_id,
            action="UPDATE",
            new_value=f"date: {old_date} -> {data.new_date} (bulk)",
            changed_by=current_user.user_id,
        ))

    for loc_id in location_ids:
        _recompute_expense_balances(db, loc_id)

    db.commit()
    msg = f"{changed} entry(ies) moved to {data.new_date}"
    if skipped:
        msg += f"; {skipped} skipped because they belong to a purchase, Mainbook entry or loan — change those there"
    return {"message": msg}


@router.patch("/{expense_id}")
def edit_expense(
    expense_id: int,
    data: ExpenseEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    expense = db.query(Expense).filter(Expense.expense_id == expense_id, Expense.deleted_at == None).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    is_stock_linked = db.query(ExpenseStockLink).filter(ExpenseStockLink.expense_id == expense_id).first()
    is_mainbook_linked = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.expense_id == expense_id).first()
    if is_stock_linked or is_mainbook_linked:
        raise HTTPException(
            status_code=400,
            detail="This entry is linked to a spare-part purchase or Mainbook entry and cannot be edited directly. Delete and re-enter instead."
        )

    changes = []

    if data.txn_date is not None and data.txn_date != expense.txn_date:
        changes.append(f"date: {expense.txn_date} -> {data.txn_date}")
        expense.txn_date = data.txn_date

    if data.description is not None:
        new_desc = smart_capitalize(data.description)
        if new_desc != expense.description:
            changes.append(f"description: {expense.description} -> {new_desc}")
            expense.description = new_desc

    if data.amount is not None:
        if float(data.amount) < 0:
            raise HTTPException(status_code=400, detail="Amount cannot be negative")
        was_debit = float(expense.debit or 0) > 0
        old_amount = float(expense.debit) if was_debit else float(expense.credit)
        if float(data.amount) != old_amount:
            changes.append(f"amount: {old_amount} -> {data.amount}")
            if was_debit:
                expense.debit = data.amount
            else:
                expense.credit = data.amount

    if not changes:
        return {"message": "No changes made"}

    _recompute_expense_balances(db, expense.location_id)

    db.add(AuditLog(
        table_name="expenses",
        record_id=expense.expense_id,
        action="UPDATE",
        new_value="; ".join(changes),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Expense updated"}


@router.delete("/bulk")
def bulk_delete_expenses(
    data: BulkDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="No entries selected")

    deleted_count = 0
    skipped = 0
    location_ids = set()

    for expense_id in data.ids:
        expense = db.query(Expense).filter(Expense.expense_id == expense_id, Expense.deleted_at == None).first()
        if not expense:
            continue
        if delete_blocked_reason(db, expense):
            skipped += 1
            continue
        expense.deleted_at = datetime.utcnow()
        expense.deleted_by = current_user.user_id
        delete_linked(db, expense, current_user.user_id)
        location_ids.add(expense.location_id)
        deleted_count += 1

        db.add(AuditLog(
            table_name="expenses",
            record_id=expense.expense_id,
            action="DELETE",
            old_value=f"debit={expense.debit} credit={expense.credit} desc={expense.description}",
            changed_by=current_user.user_id,
        ))

    for loc_id in location_ids:
        _recompute_expense_balances(db, loc_id)

    db.commit()
    msg = f"{deleted_count} expense(s) deleted"
    if skipped:
        msg += f"; {skipped} skipped because they belong to a purchase, Mainbook entry or loan with repayments — delete those there"
    return {"message": msg}


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    expense = db.query(Expense).filter(Expense.expense_id == expense_id, Expense.deleted_at == None).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    reason = delete_blocked_reason(db, expense)
    if reason:
        raise HTTPException(status_code=400, detail=reason)

    expense.deleted_at = datetime.utcnow()
    expense.deleted_by = current_user.user_id
    delete_linked(db, expense, current_user.user_id)

    _recompute_expense_balances(db, expense.location_id)

    db.add(AuditLog(
        table_name="expenses",
        record_id=expense.expense_id,
        action="DELETE",
        old_value=f"debit={expense.debit} credit={expense.credit} desc={expense.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Expense deleted", "deleted_by": current_user.full_name}


@router.get("/types")
def get_expense_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    types = db.query(ExpenseType).all()
    return [{"type_id": t.type_id, "code": t.code, "label": t.label} for t in types]