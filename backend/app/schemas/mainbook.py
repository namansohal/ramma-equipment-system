from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal


class MainbookCreate(BaseModel):
    txn_date: date
    description: str
    debit: Optional[Decimal] = 0
    credit: Optional[Decimal] = 0


class MainbookResponse(BaseModel):
    transaction_id: int
    txn_date: date
    description: Optional[str]
    debit: Optional[Decimal]
    credit: Optional[Decimal]
    balance: Optional[Decimal]

    class Config:
        from_attributes = True