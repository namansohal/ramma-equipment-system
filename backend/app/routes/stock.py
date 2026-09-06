from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime
from app.database import get_db
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.machines import Machine
from app.models.locations import Location
from app.models.machine_costs import MachinePartCost
from app.models.audit import AuditLog
from app.schemas.stock import StockTransactionCreate, StockTransactionResponse
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.post("/", response_model=StockTransactionResponse)
def create_stock_transaction(
    data: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor)
):
    if data.direction not in ("IN", "OUT"):
        raise HTTPException(status_code=400, detail="Direction must be IN or OUT")

    if data.direction == "OUT":
        current = db.query(
            func.coalesce(func.sum(
                case(
                    (StockTransaction.direction == "IN", StockTransaction.quantity),
                    else_=-StockTransaction.quantity
                )
            ), 0)
        ).filter(
            StockTransaction.part_id == data.part_id,
            StockTransaction.deleted_at == None
        ).scalar()

        if current < data.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {current}")

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

    # When issuing a part OUT to a machine, attribute its cost using the
    # most recent purchase (IN) price for that part.
    if data.direction == "OUT" and data.machine_id:
        last_purchase = db.query(StockTransaction).filter(
            StockTransaction.part_id == data.part_id,
            StockTransaction.direction == "IN",
            StockTransaction.deleted_at == None,
            StockTransaction.unit_price.isnot(None)
        ).order_by(StockTransaction.txn_date.desc(), StockTransaction.stock_txn_id.desc()).first()

        if last_purchase and last_purchase.unit_price:
            unit_price = float(last_purchase.unit_price)
            total_cost = round(unit_price * float(data.quantity), 2)

            db.add(MachinePartCost(
                machine_id=data.machine_id,
                part_id=data.part_id,
                stock_txn_id=txn.stock_txn_id,
                quantity=data.quantity,
                unit_price=unit_price,
                total_cost=total_cost,
                txn_date=data.txn_date,
            ))

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
    txns = db.query(StockTransaction).filter(
        StockTransaction.deleted_at == None
    ).order_by(StockTransaction.stock_txn_id.desc()).limit(100).all()

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

    txn.deleted_at = datetime.utcnow()
    txn.deleted_by = current_user.user_id

    # remove any attributed machine cost tied to this transaction
    db.query(MachinePartCost).filter(MachinePartCost.stock_txn_id == stock_txn_id).delete()

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