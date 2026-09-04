from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id   = Column(BigInteger, primary_key=True, index=True)
    table_name = Column(String(50), nullable=False)
    record_id  = Column(Integer, nullable=False)
    action     = Column(String(10), nullable=False)  # CREATE UPDATE DELETE RESTORE
    field_name = Column(String(100), nullable=True)
    old_value  = Column(Text, nullable=True)
    new_value  = Column(Text, nullable=True)
    changed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    user       = relationship("User")