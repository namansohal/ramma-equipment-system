from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import locations, machines, users, spare_parts, expenses, stock, audit, downtime, mainbook, loans, staff, links, machine_costs, machine_income, alerts
from app.routes import auth, expenses as expenses_router, stock as stock_router, machines as machines_router, users as users_router, machine_detail as machine_detail_router, downtime as downtime_router, mainbook as mainbook_router, reports as reports_router, audit as audit_router, loans as loans_router, staff as staff_router, purchases as purchases_router, suggestions as suggestions_router, alerts as alerts_router

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
app.include_router(users_router.router)
app.include_router(machine_detail_router.router)
app.include_router(downtime_router.router)
app.include_router(mainbook_router.router)
app.include_router(reports_router.router)
app.include_router(audit_router.router)
app.include_router(loans_router.router)
app.include_router(staff_router.router)
app.include_router(purchases_router.router)
app.include_router(suggestions_router.router)
app.include_router(alerts_router.router)


@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}