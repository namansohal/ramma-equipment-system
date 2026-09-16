from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Loan(Base):
    __tablename__ = "loans"

    loan_id      = Column(Integer, primary_key=True, index=True)
    staff_id     = Column(Integer, ForeignKey("staff.staff_id"), nullable=True)
    user_id      = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    amount       = Column(Numeric(14, 2), nullable=False)
    issued_date  = Column(Date, nullable=False)
    notes        = Column(Text, nullable=True)
    expense_id   = Column(Integer, ForeignKey("expenses.expense_id"), nullable=True)
    created_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at   = Column(DateTime(timezone=True), nullable=True)
    deleted_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    staff        = relationship("Staff")
    borrower     = relationship("User", foreign_keys=[user_id])
    creator      = relationship("User", foreign_keys=[created_by])
    repayments   = relationship("LoanRepayment", back_populates="loan")


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    repayment_id = Column(Integer, primary_key=True, index=True)
    loan_id      = Column(Integer, ForeignKey("loans.loan_id"), nullable=False)
    amount       = Column(Numeric(14, 2), nullable=False)
    paid_date    = Column(Date, nullable=False)
    notes        = Column(Text, nullable=True)
    expense_id   = Column(Integer, ForeignKey("expenses.expense_id"), nullable=True)
    created_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at   = Column(DateTime(timezone=True), nullable=True)

    loan         = relationship("Loan", back_populates="repayments")