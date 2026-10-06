"""Helpers shared by the ledger routes (expenses, mainbook, momo)."""
from sqlalchemy.orm import Session
from app.models.expenses import Expense


def ordered_expense_rows(db: Session, location_id: int):
    """Live expenses in ledger order: by date, carry-forward first within a day, then entry order."""
    rows = db.query(Expense).filter(
        Expense.location_id == location_id,
        Expense.deleted_at == None
    ).all()
    rows.sort(key=lambda r: (r.txn_date, 0 if r.is_carry_forward else 1, r.expense_id))
    return rows


def recompute_expense_balances(db: Session, location_id: int):
    db.flush()
    balance = 0.0
    for r in ordered_expense_rows(db, location_id):
        balance = balance + float(r.credit or 0) - float(r.debit or 0)
        r.balance = balance


def latest_window(rows, skip: int, limit: int):
    """The newest `limit` rows (after skipping the `skip` newest), still oldest-first.

    Ledger lists are sorted oldest-first so running balances read top to bottom;
    a plain rows[skip:skip+limit] would return the OLDEST entries and hide new ones.
    """
    end = max(len(rows) - skip, 0)
    return rows[max(end - limit, 0):end]
