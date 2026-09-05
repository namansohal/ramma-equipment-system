from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal
from app.database import get_db
from app.models.mainbook import MainbookTransaction
from app.models.expenses import Expense, ExpenseType
from app.models.locations import Location
from app.models.links import MainbookExpenseLink
from app.models.audit import AuditLog
from app.schemas.mainbook import MainbookResponse
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor

router = APIRouter(prefix="/mainbook", tags=["Mainbook"])


class MainbookCreate(BaseModel):
    txn_date: date
    description: str
    debit: Optional[float] = 0        # money out
    credit: Optional[float] = 0       # money in
    destination: Optional[str] = None  # 'expense' | 'refund' | 'momo' (only for money-out)


def _current_location(db):
    return db.query(Location).filter(Location.is_current == True).first()


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

    # If money is going out, a destination is required
    if debit > 0 and not data.destination:
        raise HTTPException(status_code=400, detail="Select where the money is going (Expense / Refund / MOMO)")
    if data.destination and data.destination not in ("expense", "refund", "momo"):
        raise HTTPException(status_code=400, detail="Invalid destination")

    last = db.query(MainbookTransaction).filter(
        MainbookTransaction.location_id == location.location_id,
        MainbookTransaction.deleted_at == None
    ).order_by(MainbookTransaction.transaction_id.desc()).first()
    last_balance = last.balance if last else 0
    new_balance = float(last_balance) + credit - debit

    desc = data.description
    if debit > 0 and data.destination:
        desc = f"{data.description} [{data.destination.upper()}]"

    txn = MainbookTransaction(
        location_id=location.location_id,
        txn_date=data.txn_date,
        description=desc,
        debit=debit,
        credit=credit,
        balance=new_balance,
        created_by=current_user.user_id,
    )
    db.add(txn)
    db.flush()

    # If destination is expense book, auto-post a money-in row to Expenses
    if debit > 0 and data.destination == "expense":
        last_exp = db.query(Expense).filter(
            Expense.location_id == location.location_id,
            Expense.deleted_at == None
        ).order_by(Expense.expense_id.desc()).first()
        exp_last_balance = last_exp.balance if last_exp else 0
        exp_new_balance = float(exp_last_balance) + debit  # money coming IN to expense book

        cash_type = db.query(ExpenseType).filter(ExpenseType.code == "cash_receipt").first()

        exp = Expense(
            location_id=location.location_id,
            expense_type_id=cash_type.type_id if cash_type else 1,
            txn_date=data.txn_date,
            description=f"Cash from Mainbook: {data.description}",
            debit=0,
            credit=debit,
            balance=exp_new_balance,
            is_common=False,
            created_by=current_user.user_id,
        )
        db.add(exp)
        db.flush()
        db.add(MainbookExpenseLink(transaction_id=txn.transaction_id, expense_id=exp.expense_id))

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="CREATE",
        new_value=f"debit={debit} credit={credit} dest={data.destination or '-'} desc={data.description}",
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
    query = db.query(MainbookTransaction).filter(MainbookTransaction.deleted_at == None)
    if on_date:
        query = query.filter(MainbookTransaction.txn_date == on_date)
    else:
        if from_date:
            query = query.filter(MainbookTransaction.txn_date >= from_date)
        if to_date:
            query = query.filter(MainbookTransaction.txn_date <= to_date)
    return query.order_by(MainbookTransaction.txn_date, MainbookTransaction.transaction_id).offset(skip).limit(limit).all()


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

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="DELETE",
        old_value=f"debit={txn.debit} credit={txn.credit} desc={txn.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Entry deleted", "deleted_by": current_user.full_name}