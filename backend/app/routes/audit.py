from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.audit import AuditLog
from app.models.users import User
from app.models.expenses import Expense
from app.models.mainbook import MainbookTransaction
from app.models.stock import StockTransaction
from app.auth import get_current_user
from app.permissions import require_admin

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/")
def list_audit(
    limit: int = 200,
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
    }
    Model = model_map.get(table)
    if not Model:
        raise HTTPException(status_code=400, detail="This record type cannot be restored")

    pk_map = {
        "expenses": "expense_id",
        "mainbook_transactions": "transaction_id",
        "stock_transactions": "stock_txn_id",
    }
    pk = pk_map[table]

    record = db.query(Model).filter(getattr(Model, pk) == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.deleted_at is None:
        raise HTTPException(status_code=400, detail="Record is not deleted")

    record.deleted_at = None
    record.deleted_by = None

    db.add(AuditLog(
        table_name=table,
        record_id=record_id,
        action="RESTORE",
        new_value="restored",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Record restored"}