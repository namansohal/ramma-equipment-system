from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MachineRuntime(Base):
    __tablename__ = "machine_runtime"

    runtime_id      = Column(Integer, primary_key=True, index=True)
    machine_id       = Column(Integer, ForeignKey("machines.machine_id"), nullable=False)
    customer_name    = Column(String(150), nullable=True)
    txn_date         = Column(Date, nullable=False)
    start_reading    = Column(Numeric(10, 2), nullable=True)
    end_reading      = Column(Numeric(10, 2), nullable=True)
    amount           = Column(Numeric(14, 2), nullable=False)
    status_note      = Column(Text, nullable=True)
    created_by       = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at       = Column(DateTime(timezone=True), nullable=True)
    deleted_by       = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    machine          = relationship("Machine")