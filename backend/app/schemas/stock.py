from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal

class StockTransactionCreate(BaseModel):
    part_id:      int
    txn_date:     date
    direction:    str
    quantity:     Decimal
    unit_price:   Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    machine_id:   Optional[int] = None
    notes:        Optional[str] = None

class StockTransactionResponse(BaseModel):
    stock_txn_id: int
    txn_date:     date
    direction:    str
    quantity:     Decimal
    unit_price:   Optional[Decimal]
    total_amount: Optional[Decimal]
    notes:        Optional[str]

    class Config:
        from_attributes = True