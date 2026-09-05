    from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MainbookTransaction(Base):
    __tablename__ = "mainbook_transactions"

    transaction_id = Column(Integer, primary_key=True, index=True)
    location_id    = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    txn_date       = Column(Date, nullable=False)
    description    = Column(Text, nullable=True)
    debit          = Column(Numeric(14, 2), default=0)
    credit         = Column(Numeric(14, 2), default=0)
    balance        = Column(Numeric(14, 2), nullable=True)
    original_balance_imported = Column(Numeric(14, 2), nullable=True)
    created_by     = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at     = Column(DateTime(timezone=True), nullable=True)
    deleted_by     = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    location       = relationship("Location")
    creator        = relationship("User", foreign_keys=[created_by])