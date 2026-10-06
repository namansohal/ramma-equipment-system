from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date
from app.database import get_db
from app.models.audit import AuditLog
from app.models.users import User
from app.models.expenses import Expense
from app.models.mainbook import MainbookTransaction
from app.models.stock import StockTransaction
from app.models.momo import MomoTransaction
from app.models.customers import CustomerPayment
from app.models.runtime import MachineRuntime
from app.models.downtime import MachineDowntime
from app.models.staff import Staff
from app.models.links import MainbookExpenseLink, ExpenseStockLink, MainbookMomoLink
from app.expense_links import restore_blocked_reason, restore_linked
from app.stock_costs import available, record_part_cost
from app.models.machine_income import MachineIncome
from app.routes.momo import _recompute_balances as _recompute_momo_balances
from app.routes.mainbook import _recompute_mainbook_balances
from app.ledger import recompute_expense_balances
from app.auth import get_current_user
from app.permissions import require_admin

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/")
def list_audit(
    limit: int = Query(200, ge=1, le=1000),
    table: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(AuditLog)
    if table:
        query = query.filter(AuditLog.table_name == table)
    logs = query.order_by(AuditLog.audit_id.desc()).limit(limit).all()

    # map user ids to names
    users = {u.user_id: u.full_name for u in db.query(User).all()}

    return [
        {
            "audit_id": l.audit_id,
            "table": l.table_name,
            "record_id": l.record_id,
            "action": l.action,
            "field": l.field_name,
            "old_value": l.old_value,
            "new_value": l.new_value,
            "changed_by": users.get(l.changed_by, "Unknown"),
            "changed_at": l.changed_at.isoformat() if l.changed_at else None,
        }
        for l in logs
    ]


def _restore_mainbook_side_effects(db: Session, txn: MainbookTransaction, user_id: int):
    """Undo what deleting a mainbook entry also did: the linked expense was
    soft-deleted and its machine income rows were removed (and logged)."""
    mlink = db.query(MainbookMomoLink).filter(MainbookMomoLink.transaction_id == txn.transaction_id).first()
    m = mlink and db.query(MomoTransaction).filter(MomoTransaction.momo_id == mlink.momo_id).first()
    if m and m.deleted_at is not None:
        m.deleted_at, m.deleted_by = None, None
        db.add(AuditLog(table_name="momo_transactions", record_id=m.momo_id, action="RESTORE",
                        new_value=f"restored with mainbook entry {txn.transaction_id}", changed_by=user_id))
        _recompute_momo_balances(db, m.location_id)
    link = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.transaction_id == txn.transaction_id).first()
    if link:
        exp = db.query(Expense).filter(Expense.expense_id == link.expense_id).first()
        if exp and exp.deleted_at is not None:
            exp.deleted_at = None
            exp.deleted_by = None
            db.add(AuditLog(table_name="expenses", record_id=exp.expense_id, action="RESTORE",
                            new_value=f"restored with mainbook entry {txn.transaction_id}", changed_by=user_id))
            recompute_expense_balances(db, exp.location_id)

    # Only income logged since the last time this entry's income was restored.
    last_restore = db.query(AuditLog).filter(
        AuditLog.table_name == "machine_income", AuditLog.record_id == txn.transaction_id,
        AuditLog.action == "RESTORE",
    ).order_by(AuditLog.audit_id.desc()).first()
    q = db.query(AuditLog).filter(
        AuditLog.table_name == "machine_income", AuditLog.record_id == txn.transaction_id,
        AuditLog.action == "DELETE",
    )
    if last_restore:
        q = q.filter(AuditLog.audit_id > last_restore.audit_id)
    restored = 0
    for log in q.all():
        fields = dict(part.split("=", 1) for part in (log.old_value or "").split())
        try:
            db.add(MachineIncome(
                machine_id=int(fields["machine_id"]),
                transaction_id=txn.transaction_id,
                amount=fields["amount"],
                txn_date=date.fromisoformat(fields["txn_date"]),
            ))
            restored += 1
        except (KeyError, ValueError):
            continue
    if restored:
        db.add(AuditLog(table_name="machine_income", record_id=txn.transaction_id, action="RESTORE",
                        new_value=f"{restored} income row(s) re-created", changed_by=user_id))


@router.post("/restore/{table}/{record_id}")
def restore_record(
    table: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can restore deleted records")

    model_map = {
        "expenses": Expense,
        "mainbook_transactions": MainbookTransaction,
        "stock_transactions": StockTransaction,
        "momo_transactions": MomoTransaction,
        "customer_payments": CustomerPayment,
        "machine_runtime": MachineRuntime,
        "machine_downtime": MachineDowntime,
        "staff": Staff,
    }
    Model = model_map.get(table)
    if not Model:
        raise HTTPException(status_code=400, detail="This record type cannot be restored")

    pk_map = {
        "expenses": "expense_id",
        "mainbook_transactions": "transaction_id",
        "stock_transactions": "stock_txn_id",
        "momo_transactions": "momo_id",
        "customer_payments": "payment_id",
        "machine_runtime": "runtime_id",
        "machine_downtime": "downtime_id",
        "staff": "staff_id",
    }
    pk = pk_map[table]

    record = db.query(Model).filter(getattr(Model, pk) == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.deleted_at is None:
        raise HTTPException(status_code=400, detail="Record is not deleted")

    if table == "expenses":
        reason = restore_blocked_reason(db, record)
        if reason:
            raise HTTPException(status_code=400, detail=reason)
    if table == "momo_transactions":
        link = db.query(MainbookMomoLink).filter(MainbookMomoLink.momo_id == record.momo_id).first()
        mb = link and db.query(MainbookTransaction).filter(MainbookTransaction.transaction_id == link.transaction_id).first()
        if mb and mb.deleted_at is not None:
            raise HTTPException(status_code=400, detail="This MOMO entry belongs to a deleted Mainbook entry. Restore the Mainbook entry instead; that restores both.")
    if table == "machine_downtime" and record.end_date is None:
        if db.query(MachineDowntime).filter(
                MachineDowntime.machine_id == record.machine_id, MachineDowntime.end_date == None,
                MachineDowntime.deleted_at == None).first():
            raise HTTPException(status_code=400, detail="This machine already has an ongoing downtime record. Resolve it first.")
    if table == "stock_transactions" and record.direction == "OUT":
        have = available(db, record.part_id)
        if have < float(record.quantity):
            raise HTTPException(status_code=400, detail=f"Can't restore: only {have:g} in stock, this issue used {float(record.quantity):g}.")

    record.deleted_at = None
    record.deleted_by = None
    if table == "staff":
        record.active = True
    # Running balances are stored per row, so they must be rebuilt after a restore.
    if table == "momo_transactions":
        _recompute_momo_balances(db, record.location_id)
    elif table == "expenses":
        restore_linked(db, record, current_user.user_id)
        recompute_expense_balances(db, record.location_id)
    elif table == "stock_transactions":
        if record.direction == "OUT":
            record_part_cost(db, record)
        else:
            link = db.query(ExpenseStockLink).filter(ExpenseStockLink.stock_txn_id == record.stock_txn_id).first()
            exp = link and db.query(Expense).filter(Expense.expense_id == link.expense_id).first()
            if exp and exp.deleted_at is not None:
                exp.deleted_at, exp.deleted_by = None, None
                db.add(AuditLog(table_name="expenses", record_id=exp.expense_id, action="RESTORE",
                                new_value=f"restored with spare-part purchase {record.stock_txn_id}", changed_by=current_user.user_id))
                recompute_expense_balances(db, exp.location_id)
    elif table == "mainbook_transactions":
        _restore_mainbook_side_effects(db, record, current_user.user_id)
        _recompute_mainbook_balances(db, record.location_id)

    db.add(AuditLog(
        table_name=table,
        record_id=record_id,
        action="RESTORE",
        new_value="restored",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Record restored"}