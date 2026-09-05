from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import locations, machines, users, spare_parts, expenses, stock, audit
from app.routes import auth, expenses as expenses_router, stock as stock_router, machines as machines_router

app = FastAPI(title="Ramma Equipment System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(expenses_router.router)
app.include_router(stock_router.router)
app.include_router(machines_router.router)


@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}