from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.database import get_db
from app.models.loans import Loan, LoanRepayment
from app.models.staff import Staff
from app.models.expenses import Expense, ExpenseType
from app.models.locations import Location
from app.models.audit import AuditLog
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor
from app.ledger import recompute_expense_balances

router = APIRouter(prefix="/loans", tags=["Loans"])


class LoanCreate(BaseModel):
    staff_id: int
    amount: float
    issued_date: date
    notes: Optional[str] = None


class RepaymentCreate(BaseModel):
    amount: float
    paid_date: date


def _recompute_expense_balances(db: Session, location_id: int):
    # Same ledger order as the Expenses page (by date), not entry order.
    recompute_expense_balances(db, location_id)


def create_loan_with_expense(db: Session, staff_id: int, amount: float, issued_date: date, notes: str, current_user: User) -> Loan:
    """
    Shared logic: creates a Loan tied to a Staff member AND a matching Expense-book
    entry (money out, type=Loan). Used by both the dedicated Loans page and the
    Expense book's "Loan" type entry point — either way produces the same record.
    """
    staff = db.query(Staff).filter(Staff.staff_id == staff_id, Staff.deleted_at == None).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    location = db.query(Location).filter(Location.is_current == True).first()
    if not location:
        raise HTTPException(status_code=400, detail="No current location set")

    last_exp = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at == None
    ).order_by(Expense.expense_id.desc()).first()
    last_balance = last_exp.balance if last_exp else 0
    new_balance = float(last_balance) - amount

    loan_type = db.query(ExpenseType).filter(ExpenseType.code == "loan").first()

    expense = Expense(
        location_id=location.location_id,
        expense_type_id=loan_type.type_id if loan_type else 1,
        txn_date=issued_date,
        description=f"Loan to {staff.full_name}" + (f" — {notes}" if notes else ""),
        debit=amount,
        credit=0,
        balance=new_balance,
        is_common=False,
        created_by=current_user.user_id,
    )
    db.add(expense)
    db.flush()

    loan = Loan(
        staff_id=staff_id,
        amount=amount,
        issued_date=issued_date,
        notes=notes,
        expense_id=expense.expense_id,
        created_by=current_user.user_id,
    )
    db.add(loan)
    db.flush()

    db.add(AuditLog(
        table_name="loans",
        record_id=loan.loan_id,
        action="CREATE",
        new_value=f"staff={staff.full_name} amount={amount}",
        changed_by=current_user.user_id,
    ))
    return loan


@router.get("/borrowers")
def list_borrowers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    staff = db.query(Staff).filter(Staff.deleted_at == None, Staff.active == True).order_by(Staff.full_name).all()
    return [{"staff_id": s.staff_id, "full_name": s.full_name} for s in staff]


@router.get("/")
def list_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loans = db.query(Loan).filter(Loan.deleted_at == None).order_by(Loan.issued_date.desc()).all()
    result = []
    for l in loans:
        paid = db.query(LoanRepayment).filter(LoanRepayment.loan_id == l.loan_id, LoanRepayment.deleted_at == None).all()
        total_paid = sum(float(p.amount) for p in paid)
        remaining = float(l.amount) - total_paid
        result.append({
            "loan_id": l.loan_id,
            "borrower": l.staff.full_name if l.staff else "(unknown)",
            "amount": float(l.amount),
            "paid": total_paid,
            "remaining": remaining,
            "issued_date": str(l.issued_date),
            "settled": remaining <= 0,
        })
    return result


@router.post("/")
def create_loan(
    data: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    loan = create_loan_with_expense(db, data.staff_id, data.amount, data.issued_date, data.notes, current_user)
    _recompute_expense_balances(db, db.query(Location).filter(Location.is_current == True).first().location_id)
    db.commit()
    return {"message": "Loan recorded", "loan_id": loan.loan_id}


@router.post("/{loan_id}/repay")
def repay_loan(
    loan_id: int,
    data: RepaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    loan = db.query(Loan).filter(Loan.loan_id == loan_id, Loan.deleted_at == None).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    location = db.query(Location).filter(Location.is_current == True).first()
    last_exp = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at == None
    ).order_by(Expense.expense_id.desc()).first()
    last_balance = last_exp.balance if last_exp else 0
    new_balance = float(last_balance) + data.amount

    loan_type = db.query(ExpenseType).filter(ExpenseType.code == "loan").first()
    staff_name = loan.staff.full_name if loan.staff else "staff"

    expense = Expense(
        location_id=location.location_id,
        expense_type_id=loan_type.type_id if loan_type else 1,
        txn_date=data.paid_date,
        description=f"Loan repayment from {staff_name}",
        debit=0,
        credit=data.amount,
        balance=new_balance,
        is_common=False,
        created_by=current_user.user_id,
    )
    db.add(expense)
    db.flush()

    repayment = LoanRepayment(
        loan_id=loan_id,
        amount=data.amount,
        paid_date=data.paid_date,
        expense_id=expense.expense_id,
        created_by=current_user.user_id,
    )
    db.add(repayment)

    db.add(AuditLog(
        table_name="loans",
        record_id=loan_id,
        action="UPDATE",
        new_value=f"repayment of {data.amount} by {staff_name}",
        changed_by=current_user.user_id,
    ))

    _recompute_expense_balances(db, location.location_id)
    db.commit()
    return {"message": "Repayment recorded"}    