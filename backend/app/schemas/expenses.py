from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal


class ExpenseCreate(BaseModel):
    txn_date: date
    description: str
    expense_type_id: int
    debit: Optional[Decimal] = 0
    credit: Optional[Decimal] = 0
    machine_ids: Optional[List[int]] = []
    notes: Optional[str] = None
    is_carry_forward: Optional[bool] = False


class ExpenseEdit(BaseModel):
    txn_date: Optional[date] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None


class ExpenseResponse(BaseModel):
    expense_id: int
    txn_date: date
    description: str
    debit: Optional[Decimal]
    credit: Optional[Decimal]
    balance: Optional[Decimal]
    is_common: bool
    is_carry_forward: bool
    machine_unresolved: bool

    class Config:
        from_attributes = True