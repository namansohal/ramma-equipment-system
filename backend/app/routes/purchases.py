from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
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
from app.models.alerts import Alert
from app.models.users import User
from app.auth import get_current_user
from app.permissions import require_editor
from app.ledger import recompute_expense_balances

router = APIRouter(prefix="/purchases", tags=["Purchases"])


class PurchaseCreate(BaseModel):
    part_id: int
    quantity: float
    unit_price: float
    txn_date: date
    supplier: Optional[str] = None
    notes: Optional[str] = None


@router.get("/history/{part_id}")
def purchase_history(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    """Past purchases of this part, for price comparison before buying."""
    txns = db.query(StockTransaction).filter(
        StockTransaction.part_id == part_id,
        StockTransaction.direction == "IN",
        StockTransaction.deleted_at == None,
        StockTransaction.unit_price.isnot(None)
    ).order_by(StockTransaction.txn_date.desc()).limit(20).all()

    lowest = db.query(func.min(StockTransaction.unit_price)).filter(
        StockTransaction.part_id == part_id,
        StockTransaction.direction == "IN",
        StockTransaction.deleted_at == None,
        StockTransaction.unit_price.isnot(None)
    ).scalar()

    return {
        "lowest_price": float(lowest) if lowest else None,
        "history": [
            {
                "date": str(t.txn_date),
                "unit_price": float(t.unit_price),
                "quantity": float(t.quantity),
                "notes": t.notes,
            }
            for t in txns
        ]
    }


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

    # Check against the lowest price ever paid for this part BEFORE this purchase
    lowest_before = db.query(func.min(StockTransaction.unit_price)).filter(
        StockTransaction.part_id == data.part_id,
        StockTransaction.direction == "IN",
        StockTransaction.deleted_at == None,
        StockTransaction.unit_price.isnot(None)
    ).scalar()

    location = db.query(Location).filter(Location.is_current == True).first()

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
        balance=0,  # set by recompute_expense_balances below
        is_common=False,
        created_by=current_user.user_id,
    )
    db.add(expense)
    db.flush()

    unit_price = float(data.unit_price)
    stock_txn = StockTransaction(
        part_id=data.part_id,
        location_id=location.location_id,
        txn_date=data.txn_date,
        direction="IN",
        quantity=data.quantity,
        unit_price=unit_price,
        total_amount=total_amount,
        machine_id=None,
        notes=data.notes or (f"Supplier: {data.supplier}" if data.supplier else None),
        issued_by=current_user.user_id,
    )
    db.add(stock_txn)
    db.flush()

    db.add(ExpenseStockLink(expense_id=expense.expense_id, stock_txn_id=stock_txn.stock_txn_id))
    # Running balances are by date, so a back-dated purchase shifts later rows.
    recompute_expense_balances(db, location.location_id)

    # Price-check alert: if this price is above the lowest ever recorded for this part
    overpaid = False
    if lowest_before is not None and unit_price > float(lowest_before):
        overpaid = True
        msg = (
            f"{current_user.full_name} bought {part.name} at ₵{unit_price}/unit "
            f"(lowest ever recorded: ₵{float(lowest_before)}/unit)"
            + (f" from {data.supplier}" if data.supplier else "")
        )

        recipients = set()
        recipients.add(current_user.user_id)
        managers_and_owner = db.query(User).filter(
            User.active == True,
            User.role.has(name="owner") | User.role.has(name="manager")
        ).all()
        for u in managers_and_owner:
            recipients.add(u.user_id)

        for uid in recipients:
            db.add(Alert(
                alert_type="price_overpay",
                message=msg,
                about_user_id=current_user.user_id,
                for_user_id=uid,
            ))

    db.add(AuditLog(
        table_name="purchases", record_id=stock_txn.stock_txn_id, action="CREATE",
        new_value=f"bought {part.name} x{data.quantity} @ {unit_price}/unit = {total_amount}" + (f" from {data.supplier}" if data.supplier else ""),
        changed_by=current_user.user_id,
    ))
    db.commit()

    response = {
        "message": f"Purchased {data.quantity} × {part.name} @ {unit_price}/unit = {total_amount} total. Stock and expenses updated.",
        "total_amount": total_amount,
        "overpaid": overpaid,
    }
    if overpaid:
        response["overpay_warning"] = f"This is above the lowest price ever paid (₵{float(lowest_before)}/unit). A note has been sent to management."
    return response