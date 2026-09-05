from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.loans import Loan, LoanRepayment
from app.models.users import User
from app.models.expenses import Expense, ExpenseType
from app.models.locations import Location
from app.models.audit import AuditLog
from app.auth import get_current_user
from app.permissions import require_editor

router = APIRouter(prefix="/loans", tags=["Loans"])


class LoanCreate(BaseModel):
    user_id: int
    amount: float
    issued_date: date
    notes: Optional[str] = None


class RepaymentCreate(BaseModel):
    amount: float
    paid_date: date
    notes: Optional[str] = None


def _current_location(db):
    return db.query(Location).filter(Location.is_current == True).first()


def _post_expense(db, current_user, txn_date, description, debit=0, credit=0):
    location = _current_location(db)
    last = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at == None
    ).order_by(Expense.expense_id.desc()).first()
    last_balance = last.balance if last else 0
    new_balance = float(last_balance) + float(credit) - float(debit)

    loan_type = db.query(ExpenseType).filter(ExpenseType.code == "loan").first()

    exp = Expense(
        location_id=location.location_id,
        expense_type_id=loan_type.type_id if loan_type else 1,
        txn_date=txn_date,
        description=description,
        debit=debit,
        credit=credit,
        balance=new_balance,
        is_common=False,
        created_by=current_user.user_id,
    )
    db.add(exp)
    db.flush()
    return exp


@router.get("/borrowers")
def list_borrowers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    users = db.query(User).filter(User.active == True).all()
    return [{"user_id": u.user_id, "full_name": u.full_name} for u in users]


@router.post("/")
def create_loan(
    data: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    borrower = db.query(User).filter(User.user_id == data.user_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Employee not found")

    exp = _post_expense(
        db, current_user, data.issued_date,
        f"Loan to {borrower.full_name}", debit=data.amount, credit=0
    )

    loan = Loan(
        user_id=data.user_id,
        amount=data.amount,
        issued_date=data.issued_date,
        notes=data.notes,
        expense_id=exp.expense_id,
        created_by=current_user.user_id,
    )
    db.add(loan)
    db.flush()

    db.add(AuditLog(
        table_name="loans", record_id=loan.loan_id, action="CREATE",
        new_value=f"loan {data.amount} to {borrower.full_name}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"Loan of {data.amount} recorded for {borrower.full_name}"}


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

    paid = db.query(func.coalesce(func.sum(LoanRepayment.amount), 0)).filter(
        LoanRepayment.loan_id == loan_id, LoanRepayment.deleted_at == None
    ).scalar()
    remaining = float(loan.amount) - float(paid)
    if data.amount > remaining + 0.001:
        raise HTTPException(status_code=400, detail=f"Repayment exceeds remaining balance ({remaining})")

    borrower = db.query(User).filter(User.user_id == loan.user_id).first()

    exp = _post_expense(
        db, current_user, data.paid_date,
        f"Loan repayment from {borrower.full_name}", debit=0, credit=data.amount
    )

    rep = LoanRepayment(
        loan_id=loan_id,
        amount=data.amount,
        paid_date=data.paid_date,
        notes=data.notes,
        expense_id=exp.expense_id,
        created_by=current_user.user_id,
    )
    db.add(rep)
    db.flush()

    db.add(AuditLog(
        table_name="loans", record_id=loan_id, action="UPDATE",
        field_name="repayment", new_value=f"repaid {data.amount}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": f"Repayment of {data.amount} recorded"}


@router.get("/")
def list_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loans = db.query(Loan).filter(Loan.deleted_at == None).order_by(Loan.loan_id.desc()).all()
    users = {u.user_id: u.full_name for u in db.query(User).all()}

    result = []
    for l in loans:
        paid = db.query(func.coalesce(func.sum(LoanRepayment.amount), 0)).filter(
            LoanRepayment.loan_id == l.loan_id, LoanRepayment.deleted_at == None
        ).scalar()
        result.append({
            "loan_id": l.loan_id,
            "borrower": users.get(l.user_id, "Unknown"),
            "amount": float(l.amount),
            "paid": float(paid),
            "remaining": float(l.amount) - float(paid),
            "issued_date": str(l.issued_date),
            "notes": l.notes,
            "settled": (float(l.amount) - float(paid)) <= 0.001,
        })
    return result