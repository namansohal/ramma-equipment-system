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
    unit_price: float             # price of ONE item
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
    if data.unit_price <= 0:
        raise HTTPException(status_code=400, detail="Price per item must be greater than zero")

    total_amount = round(data.quantity * data.unit_price, 2)

    location = db.query(Location).filter(Location.is_current == True).first()

    last = db.query(Expense).filter(
        Expense.location_id == location.location_id,
        Expense.deleted_at == None
    ).order_by(Expense.expense_id.desc()).first()
    last_balance = last.balance if last else 0
    new_balance = float(last_balance) - float(total_amount)

    sp_type = db.query(ExpenseType).filter(ExpenseType.code == "spare_part").first()

    desc = f"Spare part: {part.name} x{data.quantity} @ {data.unit_price}/unit"
    if data.supplier:
        desc += f" ({data.supplier})"

    expense = Expense(
        location_id=location.location_id,
        expense_type_id=sp_type.type_id if sp_type else 1,
        txn_date=data.txn_date,
        description=desc,
        debit=total_amount,
        credit=0,
        balance=new_balance,
        is_common=False,
        created_by=current_user.user_id,
    )
    db.add(expense)
    db.flush()

    stock_txn = StockTransaction(
        part_id=data.part_id,
        location_id=location.location_id,
        txn_date=data.txn_date,
        direction="IN",
        quantity=data.quantity,
        unit_price=data.unit_price,
        total_amount=total_amount,
        machine_id=None,
        notes=data.notes or (f"Supplier: {data.supplier}" if data.supplier else None),
        issued_by=current_user.user_id,
    )
    db.add(stock_txn)
    db.flush()

    db.add(ExpenseStockLink(expense_id=expense.expense_id, stock_txn_id=stock_txn.stock_txn_id))

    db.add(AuditLog(
        table_name="purchases", record_id=stock_txn.stock_txn_id, action="CREATE",
        new_value=f"bought {part.name} x{data.quantity} @ {data.unit_price}/unit = {total_amount}" + (f" from {data.supplier}" if data.supplier else ""),
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {
        "message": f"Purchased {data.quantity} × {part.name} @ {data.unit_price}/unit = {total_amount} total. Stock and expenses updated.",
        "total_amount": total_amount,
    }