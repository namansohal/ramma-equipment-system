from sqlalchemy import Column, Integer, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MachineIncome(Base):
    __tablename__ = "machine_income"

    income_id      = Column(Integer, primary_key=True, index=True)
    machine_id      = Column(Integer, ForeignKey("machines.machine_id"), nullable=False)
    transaction_id  = Column(Integer, ForeignKey("mainbook_transactions.transaction_id"), nullable=False)
    amount          = Column(Numeric(14, 2), nullable=False)
    txn_date        = Column(Date, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    machine         = relationship("Machine")