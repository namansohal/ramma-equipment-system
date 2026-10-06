"""Test setup: the real app on a throwaway SQLite database, rebuilt for every test.

Run from backend/:  pip install -r requirements.txt -r requirements-dev.txt && pytest
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

# Must be set before the app is imported (it reads them at import time).
_DB_FILE = Path(tempfile.mkdtemp(prefix="ramma-tests-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ["SECRET_KEY"] = "test-secret-" + "x" * 32
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ.pop("GEMINI_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import Base, engine, SessionLocal  # noqa: E402

OWNER = ("owner", "ChangeMe2026!")   # created by app.seed


class Api:
    """A test client plus a DB session and helpers for logging in and asserting."""

    def __init__(self, client, db):
        self.c = client
        self.db = db
        self.owner = self.login(*OWNER)
        self.roles = {r.name: r.role_id for r in db.query(__import__("app.models.users", fromlist=["Role"]).Role).all()}

    def login(self, username, password):
        r = self.c.post("/auth/login", data={"username": username, "password": password})
        assert r.status_code == 200, r.text
        return {"Authorization": "Bearer " + r.json()["access_token"]}

    def user(self, username, role, password=None):
        """Create a user with this role and return auth headers for them."""
        password = password or f"{username}-pass-123"
        ok(self.c.post("/users/", json={"full_name": username.title(), "username": username,
                                        "password": password, "role_id": self.roles[role]}, headers=self.owner))
        return self.login(username, password)


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}"
    return r.json() if r.content and r.headers.get("content-type", "").startswith("application/json") else r


def bad(r, word=""):
    """Expect a 400 whose message mentions `word`."""
    assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
    assert word.lower() in r.text.lower(), f"'{word}' not in {r.text}"
    return r


@pytest.fixture
def api():
    from app.seed import seed
    from app.models.expenses import ExpenseType
    from app.models.spare_parts import SparePart
    from app.models.users import Role

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed()
    db = SessionLocal()
    for code, label in (("fuel", "Fuel"), ("spare_part", "Spare Part"), ("loan", "Loan"), ("food", "Food")):
        db.add(ExpenseType(code=code, label=label))
    db.add(Role(name="viewer"))
    db.add(SparePart(name="Air Filter", active=True))
    db.add(SparePart(name="Never Bought", active=True))
    db.commit()

    with TestClient(app, raise_server_exceptions=False) as client:
        yield Api(client, db)
    db.close()


def expense_balances_consistent(db):
    """Stored running balances equal the running sum in ledger (date) order."""
    from app.models.expenses import Expense
    db.expire_all()
    rows = db.query(Expense).filter(Expense.deleted_at == None).all()  # noqa: E711
    rows.sort(key=lambda r: (r.txn_date, 0 if r.is_carry_forward else 1, r.expense_id))
    bal = 0.0
    for e in rows:
        bal += float(e.credit or 0) - float(e.debit or 0)
        assert abs(float(e.balance) - bal) < 0.001, (e.expense_id, float(e.balance), bal)
    return True
