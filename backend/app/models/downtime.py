from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MachineDowntime(Base):
    __tablename__ = "machine_downtime"

    downtime_id = Column(Integer, primary_key=True, index=True)
    machine_id  = Column(Integer, ForeignKey("machines.machine_id"), nullable=False)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=True)          # null = still down
    reason      = Column(String(200), nullable=False)
    notes       = Column(Text, nullable=True)
    created_by  = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at  = Column(DateTime(timezone=True), nullable=True)
    deleted_by  = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    machine     = relationship("Machine")
    creator     = relationship("User", foreign_keys=[created_by])