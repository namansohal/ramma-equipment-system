from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime
from app.database import get_db
from app.models.mainbook import MainbookTransaction
from app.models.locations import Location
from app.models.audit import AuditLog
from app.schemas.mainbook import MainbookCreate, MainbookResponse
from app.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/mainbook", tags=["Mainbook"])


@router.post("/", response_model=MainbookResponse)
def create_transaction(
    data: MainbookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    location = db.query(Location).filter(Location.is_current == True).first()
    if not location:
        raise HTTPException(status_code=400, detail="No current location set")

    last = db.query(MainbookTransaction).filter(
        MainbookTransaction.location_id == location.location_id,
        MainbookTransaction.deleted_at == None
    ).order_by(MainbookTransaction.transaction_id.desc()).first()

    last_balance = last.balance if last else 0
    new_balance = float(last_balance) + float(data.credit) - float(data.debit)

    txn = MainbookTransaction(
        location_id=location.location_id,
        txn_date=data.txn_date,
        description=data.description,
        debit=data.debit,
        credit=data.credit,
        balance=new_balance,
        created_by=current_user.user_id,
    )
    db.add(txn)
    db.flush()

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="CREATE",
        new_value=f"debit={data.debit} credit={data.credit} desc={data.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/", response_model=List[MainbookResponse])
def list_transactions(
    skip: int = 0,
    limit: int = 200,
    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(MainbookTransaction).filter(MainbookTransaction.deleted_at == None)
    if from_date:
        query = query.filter(MainbookTransaction.txn_date >= from_date)
    if to_date:
        query = query.filter(MainbookTransaction.txn_date <= to_date)
    return query.order_by(MainbookTransaction.txn_date, MainbookTransaction.transaction_id).offset(skip).limit(limit).all()


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    txn = db.query(MainbookTransaction).filter(
        MainbookTransaction.transaction_id == transaction_id,
        MainbookTransaction.deleted_at == None
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn.deleted_at = datetime.utcnow()
    txn.deleted_by = current_user.user_id

    db.add(AuditLog(
        table_name="mainbook_transactions",
        record_id=txn.transaction_id,
        action="DELETE",
        old_value=f"debit={txn.debit} credit={txn.credit} desc={txn.description}",
        changed_by=current_user.user_id,
    ))
    db.commit()
    return {"message": "Entry deleted", "deleted_by": current_user.full_name}