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
from app.models.links import MainbookExpenseLink
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
    }
    Model = model_map.get(table)
    if not Model:
        raise HTTPException(status_code=400, detail="This record type cannot be restored")

    pk_map = {
        "expenses": "expense_id",
        "mainbook_transactions": "transaction_id",
        "stock_transactions": "stock_txn_id",
        "momo_transactions": "momo_id",
    }
    pk = pk_map[table]

    record = db.query(Model).filter(getattr(Model, pk) == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.deleted_at is None:
        raise HTTPException(status_code=400, detail="Record is not deleted")

    record.deleted_at = None
    record.deleted_by = None
    # Running balances are stored per row, so they must be rebuilt after a restore.
    if table == "momo_transactions":
        _recompute_momo_balances(db, record.location_id)
    elif table == "expenses":
        recompute_expense_balances(db, record.location_id)
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