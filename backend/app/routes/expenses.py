from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.database import get_db
from app.models.expenses import Expense, ExpenseMachineLink, ExpenseType
from app.models.locations import Location
from app.models.audit import AuditLog
from app.schemas.expenses import ExpenseCreate, ExpenseResponse
from app.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.post("/", response_model=ExpenseResponse)
def create_expense(
    data:         ExpenseCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    # Get current location (Kade)
    location = db.query(Location).filter(Location.is_current == True).first()
    if not location:
        raise HTTPException(status_code=400, detail="No current location set")

    # Get last balance for this location
    last = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at  == None
    ).order_by(Expense.expense_id.desc()).first()

    last_balance = last.balance if last else 0
    new_balance  = float(last_balance) + float(data.credit) - float(data.debit)

    is_common = len(data.machine_ids) == 0

    expense = Expense(
        location_id     = location.location_id,
        expense_type_id = data.expense_type_id,
        txn_date        = data.txn_date,
        description     = data.description,
        debit           = data.debit,
        credit          = data.credit,
        balance         = new_balance,
        is_common       = is_common,
        created_by      = current_user.user_id,
    )
    db.add(expense)
    db.flush()

    # Link machines
    for machine_id in data.machine_ids:
        link = ExpenseMachineLink(
            expense_id = expense.expense_id,
            machine_id = machine_id
        )
        db.add(link)

    # Audit log
    audit = AuditLog(
        table_name = "expenses",
        record_id  = expense.expense_id,
        action     = "CREATE",
        new_value  = f"debit={data.debit} credit={data.credit} desc={data.description}",
        changed_by = current_user.user_id,
    )
    db.add(audit)
    db.commit()
    db.refresh(expense)
    return expense

@router.get("/", response_model=List[ExpenseResponse])
def get_expenses(
    skip:         int     = 0,
    limit:        int     = 100,
    from_date:    date    = None,
    to_date:      date    = None,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    query = db.query(Expense).filter(Expense.deleted_at == None)

    if from_date:
        query = query.filter(Expense.txn_date >= from_date)
    if to_date:
        query = query.filter(Expense.txn_date <= to_date)

    return query.order_by(Expense.txn_date, Expense.expense_id).offset(skip).limit(limit).all()

@router.get("/types")
def get_expense_types(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user)
):
    return db.query(ExpenseType).all()