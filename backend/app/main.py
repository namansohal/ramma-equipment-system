from fastapi import FastAPI
from app.database import engine, Base

app = FastAPI(title="Ramma Equipment System")

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}