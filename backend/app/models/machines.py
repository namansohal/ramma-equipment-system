from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Machine(Base):
    __tablename__ = "machines"

    machine_id  = Column(Integer, primary_key=True, index=True)
    code        = Column(String(10), unique=True, nullable=False)
    name        = Column(String(100), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    active      = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    location    = relationship("Location")