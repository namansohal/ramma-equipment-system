from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.database import get_db
from app.models.expenses import Expense, ExpenseType
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.locations import Location
from app.models.links import ExpenseStockLink
from app.models.audit import AuditLog
from app.models.users import User
from app.auth import get_current_user
from app.permissions import require_editor

router = APIRouter(prefix="/purchases", tags=["Purchases"])


class PurchaseCreate(BaseModel):
    part_id: int
    quantity: float
    amount: float                # total amount paid (money out)
    txn_date: date
    supplier: Optional[str] = None
    notes: Optional[str] = None


@router.post("/spare-part")
def purchase_spare_part(
    data: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    part = db.query(SparePart).filter(SparePart.part_id == data.part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    location = db.query(Location).filter(Location.is_current == True).first()

    # 1. Create the expense (money out)
    last = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at == None
    ).order_by(Expense.expense_id.desc()).first()
    last_balance = last.balance if last else 0
    new_balance = float(last_balance) - float(data.amount)

    sp_type = db.query(ExpenseType).filter(ExpenseType.code == "spare_part").first()

    desc = f"Spare part: {part.name} x{data.quantity}"
    if data.supplier:
        desc += f" ({data.supplier})"

    expense = Expense(
        location_id=location.location_id,
        expense_type_id=sp_type.type_id if sp_type else 1,
        txn_date=data.txn_date,
        description=desc,
        debit=data.amount,
        credit=0,
        balance=new_balance,
        is_common=False,
        created_by=current_user.user_id,
    )
    db.add(expense)
    db.flush()

    # 2. Create the stock-IN (inventory up)
    unit_price = float(data.amount) / float(data.quantity) if data.quantity else 0
    stock_txn = StockTransaction(
        part_id=data.part_id,
        location_id=location.location_id,
        txn_date=data.txn_date,
        direction="IN",
        quantity=data.quantity,
        unit_price=unit_price,
        total_amount=data.amount,
        machine_id=None,
        notes=data.notes or (f"Supplier: {data.supplier}" if data.supplier else None),
        issued_by=current_user.user_id,
    )
    db.add(stock_txn)
    db.flush()

    # 3. Link them
    db.add(ExpenseStockLink(expense_id=expense.expense_id, stock_txn_id=stock_txn.stock_txn_id))

    # 4. Audit
    db.add(AuditLog(
        table_name="purchases", record_id=stock_txn.stock_txn_id, action="CREATE",
        new_value=f"bought {part.name} x{data.quantity} for {data.amount}" + (f" from {data.supplier}" if data.supplier else ""),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {
        "message": f"Purchased {data.quantity} × {part.name} for {data.amount}. Stock and expenses updated.",
    }