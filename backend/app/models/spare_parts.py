from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

class SparePart(Base):
    __tablename__ = "spare_parts"

    part_id    = Column(Integer, primary_key=True, index=True)
    name       = Column(String(200), unique=True, nullable=False)
    unit       = Column(String(30), nullable=True)
    active     = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())