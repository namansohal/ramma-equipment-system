from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    alert_id      = Column(Integer, primary_key=True, index=True)
    alert_type    = Column(String(50), nullable=False)
    message       = Column(Text, nullable=False)
    about_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    for_user_id   = Column(Integer, ForeignKey("users.user_id"), nullable=True)  # who should see this specific alert row
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    is_read       = Column(Boolean, default=False, nullable=False)
    deleted_at    = Column(DateTime(timezone=True), nullable=True)
    deleted_by    = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    about_user    = relationship("User", foreign_keys=[about_user_id])
    for_user      = relationship("User", foreign_keys=[for_user_id])