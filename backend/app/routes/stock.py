from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime
from app.database import get_db
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.machines import Machine
from app.models.locations import Location
from app.models.audit import AuditLog
from app.schemas.stock import StockTransactionCreate, StockTransactionResponse
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor
from app.models.expenses import Expense
from app.models.links import ExpenseStockLink
from app.ledger import recompute_expense_balances
from app.stock_costs import available, record_part_cost, remove_part_cost

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.post("/", response_model=StockTransactionResponse)
def create_stock_transaction(
    data: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    if data.direction not in ("IN", "OUT"):
        raise HTTPException(status_code=400, detail="Direction must be IN or OUT")

    if data.quantity is None or data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    # Lock this part's row for the duration of the transaction so that concurrent
    # requests for the SAME part are serialized — the second request waits until
    # the first fully commits, then sees the updated stock before proceeding.
    # This closes the race condition where two simultaneous OUT requests could
    # both pass the availability check before either was recorded.
    part = db.query(SparePart).filter(
        SparePart.part_id == data.part_id
    ).with_for_update().first()

    if not part:
        raise HTTPException(status_code=404, detail="Part not found")

    if data.direction == "OUT":
        current = available(db, data.part_id)
        if current < data.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {current:g}")

    location = db.query(Location).filter(Location.is_current == True).first()

    txn = StockTransaction(
        part_id=data.part_id,
        location_id=location.location_id,
        txn_date=data.txn_date,
        direction=data.direction,
        quantity=data.quantity,
        unit_price=data.unit_price,
        total_amount=data.total_amount,
        machine_id=data.machine_id,
        notes=data.notes,
        issued_by=current_user.user_id,
    )
    db.add(txn)
    db.flush()
    # Charge the part to the machine it was issued to (at the latest purchase price).
    record_part_cost(db, txn)

    db.add(AuditLog(
        table_name="stock_transactions",
        record_id=txn.stock_txn_id,
        action="CREATE",
        new_value=f"direction={data.direction} qty={data.quantity} part={data.part_id}" + (f" machine={data.machine_id}" if data.machine_id else ""),
        changed_by=current_user.user_id,
    ))
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/current")
def get_current_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = db.query(
        StockTransaction.part_id,
        func.sum(
            case(
                (StockTransaction.direction == "IN", StockTransaction.quantity),
                else_=-StockTransaction.quantity
            )
        ).label("available")
    ).filter(
        StockTransaction.deleted_at == None
    ).group_by(StockTransaction.part_id).all()

    parts = {p.part_id: p.name for p in db.query(SparePart).all()}
    return [
        {"part_id": r.part_id, "name": parts.get(r.part_id), "available": r.available}
        for r in results
    ]


@router.get("/history")
def stock_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    limit = 100

    txns = db.query(StockTransaction).filter(
        StockTransaction.deleted_at == None
    ).order_by(StockTransaction.stock_txn_id.desc()).limit(limit).all()

    parts = {p.part_id: p.name for p in db.query(SparePart).all()}
    machines = {m.machine_id: m.code for m in db.query(Machine).all()}

    return [
        {
            "stock_txn_id": t.stock_txn_id,
            "date": str(t.txn_date),
            "part": parts.get(t.part_id),
            "direction": t.direction,
            "quantity": float(t.quantity),
            "machine": machines.get(t.machine_id) if t.machine_id else None,
        }
        for t in txns
    ]


@router.delete("/{stock_txn_id}")
def delete_stock_transaction(
    stock_txn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    txn = db.query(StockTransaction).filter(
        StockTransaction.stock_txn_id == stock_txn_id,
        StockTransaction.deleted_at == None
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.direction == "IN":
        left = available(db, txn.part_id) - float(txn.quantity)
        if left < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Can't delete: {left + float(txn.quantity):g} in stock and {float(txn.quantity):g} would be removed. "
                       f"Delete the later issues of this part first."
            )

    txn.deleted_at = datetime.utcnow()
    txn.deleted_by = current_user.user_id

    if txn.direction == "OUT":
        remove_part_cost(db, txn.stock_txn_id)
    else:
        # A purchase made from Spare Parts also created an expense; remove it with the stock.
        link = db.query(ExpenseStockLink).filter(ExpenseStockLink.stock_txn_id == txn.stock_txn_id).first()
        exp = link and db.query(Expense).filter(Expense.expense_id == link.expense_id, Expense.deleted_at == None).first()
        if exp:
            exp.deleted_at = datetime.utcnow()
            exp.deleted_by = current_user.user_id
            db.add(AuditLog(table_name="expenses", record_id=exp.expense_id, action="DELETE",
                            old_value=f"auto-deleted with spare-part purchase {txn.stock_txn_id}",
                            changed_by=current_user.user_id))
            recompute_expense_balances(db, exp.location_id)

    db.add(AuditLog(
        table_name="stock_transactions",
        record_id=txn.stock_txn_id,
        action="DELETE",
        old_value=f"direction={txn.direction} qty={txn.quantity} part={txn.part_id}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Transaction deleted", "deleted_by": current_user.full_name}


@router.get("/parts")
def get_parts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    parts = db.query(SparePart).filter(SparePart.active == True).order_by(SparePart.name).all()
    return [{"part_id": p.part_id, "name": p.name, "unit": p.unit} for p in parts]