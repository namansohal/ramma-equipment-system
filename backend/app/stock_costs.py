"""Stock levels and the cost of parts issued to machines."""
from datetime import date
from typing import Optional
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models.stock import StockTransaction
from app.models.machine_costs import MachinePartCost


def available(db: Session, part_id: int) -> float:
    """Units of a part in stock (live IN minus live OUT)."""
    return float(db.query(
        func.coalesce(func.sum(case(
            (StockTransaction.direction == "IN", StockTransaction.quantity),
            else_=-StockTransaction.quantity,
        )), 0)
    ).filter(
        StockTransaction.part_id == part_id,
        StockTransaction.deleted_at == None,
    ).scalar() or 0)


def unit_cost(db: Session, part_id: int, on_date: date) -> Optional[float]:
    """Price paid on the latest purchase of this part on or before `on_date`;
    if it was only bought later, the earliest purchase price. None if never bought with a price."""
    base = db.query(StockTransaction).filter(
        StockTransaction.part_id == part_id,
        StockTransaction.direction == "IN",
        StockTransaction.deleted_at == None,
        StockTransaction.unit_price.isnot(None),
        StockTransaction.unit_price > 0,
    )
    hit = base.filter(StockTransaction.txn_date <= on_date).order_by(
        StockTransaction.txn_date.desc(), StockTransaction.stock_txn_id.desc()).first()
    if not hit:
        hit = base.order_by(StockTransaction.txn_date.asc(), StockTransaction.stock_txn_id.asc()).first()
    return float(hit.unit_price) if hit else None


def record_part_cost(db: Session, txn: StockTransaction) -> bool:
    """Charge a part issued to a machine to that machine. Safe to call twice."""
    if txn.direction != "OUT" or not txn.machine_id or txn.deleted_at is not None:
        return False
    if db.query(MachinePartCost).filter(MachinePartCost.stock_txn_id == txn.stock_txn_id).first():
        return False
    price = unit_cost(db, txn.part_id, txn.txn_date)
    if price is None:
        return False
    qty = float(txn.quantity)
    db.add(MachinePartCost(
        machine_id=txn.machine_id, part_id=txn.part_id, stock_txn_id=txn.stock_txn_id,
        quantity=qty, unit_price=price, total_cost=round(qty * price, 2), txn_date=txn.txn_date,
    ))
    return True


def remove_part_cost(db: Session, stock_txn_id: int):
    db.query(MachinePartCost).filter(MachinePartCost.stock_txn_id == stock_txn_id).delete()


def backfill_part_costs(db: Session) -> int:
    """Create costs for live machine issues that don't have one yet (issues made
    before costs were recorded). Idempotent; returns how many were added."""
    has_cost = db.query(MachinePartCost.stock_txn_id)
    missing = db.query(StockTransaction).filter(
        StockTransaction.direction == "OUT",
        StockTransaction.machine_id.isnot(None),
        StockTransaction.deleted_at == None,
        ~StockTransaction.stock_txn_id.in_(has_cost),
    ).all()
    added = sum(1 for t in missing if record_part_cost(db, t))
    db.commit()
    return added
