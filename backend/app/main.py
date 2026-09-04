from fastapi import FastAPI
from app.database import engine, Base
from app.models import locations, machines, users, spare_parts, expenses, stock, audit
from app.routes import auth, expenses as expenses_router, stock as stock_router

app = FastAPI(title="Ramma Equipment System")

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(expenses_router.router)
app.include_router(stock_router.router)

@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}