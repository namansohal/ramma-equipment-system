from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.machines import Machine
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.expenses import Expense, ExpenseMachineLink
from app.models.machine_costs import MachinePartCost
from app.models.machine_income import MachineIncome
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

    direct_expenses = db.query(
        Expense.txn_date, Expense.description, Expense.debit
    ).join(
        ExpenseMachineLink, ExpenseMachineLink.expense_id == Expense.expense_id
    ).filter(
        ExpenseMachineLink.machine_id == machine_id,
        Expense.deleted_at == None
    ).all()

    total_direct = db.query(
        func.coalesce(func.sum(Expense.debit), 0)
    ).join(
        ExpenseMachineLink, ExpenseMachineLink.expense_id == Expense.expense_id
    ).filter(
        ExpenseMachineLink.machine_id == machine_id,
        Expense.deleted_at == None
    ).scalar()

    part_costs = db.query(
        MachinePartCost.txn_date, SparePart.name, MachinePartCost.total_cost
    ).join(
        SparePart, SparePart.part_id == MachinePartCost.part_id
    ).filter(
        MachinePartCost.machine_id == machine_id
    ).all()

    total_part_costs = db.query(
        func.coalesce(func.sum(MachinePartCost.total_cost), 0)
    ).filter(MachinePartCost.machine_id == machine_id).scalar()

    # Income (from Mainbook payments tagged to this machine)
    income_rows = db.query(MachineIncome).filter(MachineIncome.machine_id == machine_id).all()
    total_income = sum(float(i.amount) for i in income_rows)

    combined_expenses = [
        {"date": str(e.txn_date), "description": e.description, "amount": float(e.debit or 0)}
        for e in direct_expenses
    ] + [
        {"date": str(p.txn_date), "description": f"{p.name} (part cost)", "amount": float(p.total_cost)}
        for p in part_costs
    ]
    combined_expenses.sort(key=lambda x: x["date"], reverse=True)

    total_expense = float(total_direct or 0) + float(total_part_costs or 0)
    profit = total_income - total_expense

    return {
        "machine": {
            "machine_id": machine.machine_id,
            "code": machine.code,
            "name": machine.name,
        },
        "summary": {
            "distinct_parts": len(parts_used),
            "total_income": total_income,
            "total_expense": total_expense,
            "profit": profit,
            "expense_count": len(combined_expenses),
        },
        "parts_used": [
            {"name": p.name, "total_qty": float(p.total_qty), "times": p.times}
            for p in parts_used
        ],
        "recent_parts": [
            {"date": str(p.txn_date), "name": p.name, "quantity": float(p.quantity)}
            for p in recent_parts
        ],
        "expenses": combined_expenses[:20],
    }