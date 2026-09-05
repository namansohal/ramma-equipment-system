from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List
from app.database import get_db
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.locations import Location
from app.models.audit import AuditLog
from app.schemas.stock import StockTransactionCreate, StockTransactionResponse
from app.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.post("/", response_model=StockTransactionResponse)
def create_stock_transaction(
    data: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {current}"
            )

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

    audit = AuditLog(
        table_name="stock_transactions",
        record_id=txn.stock_txn_id,
        action="CREATE",
        new_value=f"direction={data.direction} qty={data.quantity} part={data.part_id}",
        changed_by=current_user.user_id,
    )
    db.add(audit)
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


@router.get("/parts")
def get_parts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    parts = db.query(SparePart).filter(SparePart.active == True).order_by(SparePart.name).all()
    return [
        {"part_id": p.part_id, "name": p.name, "unit": p.unit}
        for p in parts
    ]