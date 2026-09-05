from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Staff(Base):
    __tablename__ = "staff"

    staff_id       = Column(Integer, primary_key=True, index=True)
    full_name      = Column(String(150), nullable=False)
    designation    = Column(String(100), nullable=True)
    department     = Column(String(100), nullable=True)
    monthly_salary = Column(Numeric(14, 2), nullable=True)
    currency       = Column(String(3), nullable=False, default="GHS")  # GHS or INR
    join_date      = Column(Date, nullable=True)
    active         = Column(Boolean, nullable=False, default=True)
    created_by     = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at     = Column(DateTime(timezone=True), nullable=True)
    deleted_by     = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    creator        = relationship("User", foreign_keys=[created_by])