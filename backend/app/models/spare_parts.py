from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.sql import func
from app.database import Base

class SparePart(Base):
    __tablename__ = "spare_parts_catalog"

    part_id    = Column(Integer, primary_key=True, index=True)
    name       = Column(String(200), unique=True, nullable=False)
    unit       = Column(String(30), nullable=True)
    active     = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PartSetting(Base):
    """Per-part settings kept in their own table (adding a column to
    spare_parts_catalog would need a migration)."""
    __tablename__ = "part_settings"

    part_id   = Column(Integer, ForeignKey("spare_parts_catalog.part_id"), primary_key=True)
    min_level = Column(Numeric(10, 2), nullable=True)
