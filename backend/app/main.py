from fastapi import FastAPI
from app.database import engine, Base
from app.models import locations, machines, users
from app.routes import auth

app = FastAPI(title="Ramma Equipment System")

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}