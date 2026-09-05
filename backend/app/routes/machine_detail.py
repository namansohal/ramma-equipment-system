from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.database import get_db
from app.models.machines import Machine
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.expenses import Expense, ExpenseMachineLink
from app.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/machine-detail", tags=["Machine Detail"])


@router.get("/{machine_id}")
def machine_detail(
    machine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Parts used on this machine (stock OUT transactions)
    parts_used = db.query(
        SparePart.name,
        func.sum(StockTransaction.quantity).label("total_qty"),
        func.count(StockTransaction.stock_txn_id).label("times")
    ).join(
        SparePart, SparePart.part_id == StockTransaction.part_id
    ).filter(
        StockTransaction.machine_id == machine_id,
        StockTransaction.direction == "OUT",
        StockTransaction.deleted_at == None
    ).group_by(SparePart.name).all()

    # Recent part issues (detailed list)
    recent_parts = db.query(
        StockTransaction.txn_date,
        SparePart.name,
        StockTransaction.quantity
    ).join(
        SparePart, SparePart.part_id == StockTransaction.part_id
    ).filter(
        StockTransaction.machine_id == machine_id,
        StockTransaction.direction == "OUT",
        StockTransaction.deleted_at == None
    ).order_by(StockTransaction.txn_date.desc()).limit(20).all()

    # Expenses linked to this machine
    expenses = db.query(
        Expense.txn_date,
        Expense.description,
        Expense.debit
    ).join(
        ExpenseMachineLink, ExpenseMachineLink.expense_id == Expense.expense_id
    ).filter(
        ExpenseMachineLink.machine_id == machine_id,
        Expense.deleted_at == None
    ).order_by(Expense.txn_date.desc()).limit(20).all()

    total_expense = db.query(
        func.coalesce(func.sum(Expense.debit), 0)
    ).join(
        ExpenseMachineLink, ExpenseMachineLink.expense_id == Expense.expense_id
    ).filter(
        ExpenseMachineLink.machine_id == machine_id,
        Expense.deleted_at == None
    ).scalar()

    return {
        "machine": {
            "machine_id": machine.machine_id,
            "code": machine.code,
            "name": machine.name,
        },
        "summary": {
            "distinct_parts": len(parts_used),
            "total_expense": float(total_expense or 0),
            "expense_count": len(expenses),
        },
        "parts_used": [
            {"name": p.name, "total_qty": float(p.total_qty), "times": p.times}
            for p in parts_used
        ],
        "recent_parts": [
            {"date": str(p.txn_date), "name": p.name, "quantity": float(p.quantity)}
            for p in recent_parts
        ],
        "expenses": [
            {"date": str(e.txn_date), "description": e.description, "amount": float(e.debit or 0)}
            for e in expenses
        ],
    }