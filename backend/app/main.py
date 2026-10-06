import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import locations, machines, users, spare_parts, expenses, stock, audit, downtime, mainbook, loans, staff, links, machine_costs, machine_income, alerts, runtime, momo, customers, login_attempts
from app.routes import auth, expenses as expenses_router, stock as stock_router, machines as machines_router, users as users_router, machine_detail as machine_detail_router, downtime as downtime_router, mainbook as mainbook_router, reports as reports_router, audit as audit_router, loans as loans_router, staff as staff_router, purchases as purchases_router, suggestions as suggestions_router, alerts as alerts_router, ai_extract as ai_extract_router, runtime as runtime_router, momo as momo_router, customers as customers_router, backup as backup_router, locations as locations_router

app = FastAPI(title="Ramma Equipment System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ramma-equipment-system.vercel.app",
        "https://ramma-equipment-system-git-main-namans-projects-6f969b27.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # lets the browser read download file names
)

Base.metadata.create_all(bind=engine)

# Then apply migrations (column changes etc.). A failure stops startup on
# purpose: Render keeps the previous deploy running instead of serving a
# half-migrated database.
from app.migrate import run_migrations  # noqa: E402
run_migrations()


def _backfill_part_costs():
    """One-off catch-up: parts issued to machines before their cost was recorded."""
    from app.database import SessionLocal
    from app.stock_costs import backfill_part_costs
    db = SessionLocal()
    try:
        added = backfill_part_costs(db)
        if added:
            logging.getLogger(__name__).info("Recorded cost for %d earlier part issue(s)", added)
    except Exception:
        db.rollback()
        logging.getLogger(__name__).exception("Part cost backfill failed")
    finally:
        db.close()


_backfill_part_costs()

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
app.include_router(ai_extract_router.router)
app.include_router(runtime_router.router)
app.include_router(momo_router.router)
app.include_router(customers_router.router)
app.include_router(backup_router.router)
app.include_router(locations_router.router)


@app.get("/")
def root():
    return {"message": "Ramma Equipment System is running"}