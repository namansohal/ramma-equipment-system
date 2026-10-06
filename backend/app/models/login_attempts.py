from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base


class FailedLogin(Base):
    """One row per failed login, keyed by "u:<username>" and "ip:<address>".
    Rows older than the throttle window are deleted as new ones arrive."""
    __tablename__ = "failed_logins"

    id   = Column(Integer, primary_key=True)
    key  = Column(String(200), nullable=False)
    at   = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (Index("ix_failed_logins_key_at", "key", "at"),)
