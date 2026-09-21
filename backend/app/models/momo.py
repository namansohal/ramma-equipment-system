from sqlalchemy import Column, Integer, Numeric, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MomoTransaction(Base):
    __tablename__ = "momo_transactions"

    momo_id          = Column(Integer, primary_key=True, index=True)
    location_id      = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    txn_date         = Column(Date, nullable=False)
    description      = Column(Text, nullable=False)
    debit            = Column(Numeric(14, 2), default=0)
    credit           = Column(Numeric(14, 2), default=0)
    balance          = Column(Numeric(14, 2), nullable=True)
    is_carry_forward = Column(Boolean, default=False, nullable=False)
    created_by       = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at       = Column(DateTime(timezone=True), nullable=True)
    deleted_by       = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    location         = relationship("Location")