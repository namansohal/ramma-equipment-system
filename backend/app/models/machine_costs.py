from sqlalchemy import Column, Integer, Numeric, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MachinePartCost(Base):
    __tablename__ = "machine_part_costs"

    cost_id       = Column(Integer, primary_key=True, index=True)
    machine_id    = Column(Integer, ForeignKey("machines.machine_id"), nullable=False)
    part_id       = Column(Integer, ForeignKey("spare_parts_catalog.part_id"), nullable=False)
    stock_txn_id  = Column(Integer, ForeignKey("stock_transactions.stock_txn_id"), nullable=False)
    quantity      = Column(Numeric(10, 2), nullable=False)
    unit_price    = Column(Numeric(10, 2), nullable=False)
    total_cost    = Column(Numeric(14, 2), nullable=False)
    txn_date      = Column(Date, nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    machine       = relationship("Machine")