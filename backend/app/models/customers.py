from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class CustomerPayment(Base):
    """Money received from a runtime customer. Customers are identified by the
    name typed on runtime entries; `customer_key` is that name normalised."""
    __tablename__ = "customer_payments"

    payment_id    = Column(Integer, primary_key=True, index=True)
    customer_key  = Column(String(150), nullable=False, index=True)
    customer_name = Column(String(150), nullable=False)
    txn_date      = Column(Date, nullable=False)
    amount        = Column(Numeric(14, 2), nullable=False)
    method        = Column(String(20), nullable=True)
    notes         = Column(Text, nullable=True)
    created_by    = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at    = Column(DateTime(timezone=True), nullable=True)
    deleted_by    = Column(Integer, ForeignKey("users.user_id"), nullable=True)
