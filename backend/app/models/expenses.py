from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ExpenseType(Base):
    __tablename__ = "expense_types"

    type_id = Column(Integer, primary_key=True, index=True)
    code    = Column(String(30), unique=True, nullable=False)
    label   = Column(String(100), nullable=False)

class Expense(Base):
    __tablename__ = "expenses"

    expense_id          = Column(Integer, primary_key=True, index=True)
    location_id         = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    expense_type_id     = Column(Integer, ForeignKey("expense_types.type_id"), nullable=False)
    txn_date            = Column(Date, nullable=False)
    description         = Column(Text, nullable=False)
    debit               = Column(Numeric(14,2), default=0)
    credit              = Column(Numeric(14,2), default=0)
    balance             = Column(Numeric(14,2), nullable=True)
    original_balance_imported = Column(Numeric(14,2), nullable=True)
    common_raw          = Column(String(50), nullable=True)
    machine_unresolved  = Column(Boolean, default=False)
    is_common           = Column(Boolean, default=False)
    created_by          = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at          = Column(DateTime(timezone=True), nullable=True)
    deleted_by          = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    location            = relationship("Location")
    expense_type        = relationship("ExpenseType")
    creator             = relationship("User", foreign_keys=[created_by])
    machine_links       = relationship("ExpenseMachineLink", back_populates="expense")

class ExpenseMachineLink(Base):
    __tablename__ = "expense_machine_links"

    expense_id  = Column(Integer, ForeignKey("expenses.expense_id"), primary_key=True)
    machine_id  = Column(Integer, ForeignKey("machines.machine_id"), primary_key=True)

    expense     = relationship("Expense", back_populates="machine_links")
    machine     = relationship("Machine")