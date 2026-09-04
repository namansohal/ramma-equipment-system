from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    stock_txn_id = Column(Integer, primary_key=True, index=True)
    part_id      = Column(Integer, ForeignKey("spare_parts_catalog.part_id"), nullable=False)
    location_id  = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    txn_date     = Column(Date, nullable=False)
    direction    = Column(String(3), nullable=False)  # IN or OUT
    quantity     = Column(Numeric(10,2), nullable=False)
    unit_price   = Column(Numeric(10,2), nullable=True)
    total_amount = Column(Numeric(14,2), nullable=True)
    machine_id   = Column(Integer, ForeignKey("machines.machine_id"), nullable=True)
    notes        = Column(Text, nullable=True)
    issued_by    = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at   = Column(DateTime(timezone=True), nullable=True)
    deleted_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    part         = relationship("SparePart")
    location     = relationship("Location")
    machine      = relationship("Machine")
    issuer       = relationship("User", foreign_keys=[issued_by])