from fastapi import FastAPI
from app.database import engine, Base

# Import all models so SQLAlchemy knows about them
from app.models import locations, machines, users

app = FastAPI(title="Ramma Equipment System")

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}