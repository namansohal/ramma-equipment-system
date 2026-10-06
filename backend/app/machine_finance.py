"""Per-machine money figures, shared by the machine detail page and the profit report.

Costs:   expenses tagged to the machine + spare-part costs issued to it.
         An expense tagged to several machines is split evenly between them,
         so fleet totals add up to what was actually spent.
Income:  mainbook payments tagged to the machine (money received).
Billed:  runtime entry amounts (money earned/charged, received or not).
"""
from collections import defaultdict
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from app.models.expenses import Expense, ExpenseMachineLink
from app.models.machine_costs import MachinePartCost
from app.models.machine_income import MachineIncome
from app.models.runtime import MachineRuntime


def _in_range(q, column, from_date: Optional[date], to_date: Optional[date]):
    if from_date:
        q = q.filter(column >= from_date)
    if to_date:
        q = q.filter(column <= to_date)
    return q


def expense_shares(db: Session, machine_id: Optional[int] = None,
                   from_date: Optional[date] = None, to_date: Optional[date] = None):
    """[(machine_id, expense, share)] for live expenses tagged to machines."""
    q = db.query(ExpenseMachineLink.machine_id, Expense).join(
        Expense, Expense.expense_id == ExpenseMachineLink.expense_id
    ).filter(Expense.deleted_at == None)
    q = _in_range(q, Expense.txn_date, from_date, to_date)
    rows = q.all()

    # How many machines share each expense (counted over all its links, not just this machine's).
    expense_ids = {e.expense_id for _, e in rows}
    counts = defaultdict(int)
    if expense_ids:
        for (eid,) in db.query(ExpenseMachineLink.expense_id).filter(ExpenseMachineLink.expense_id.in_(expense_ids)).all():
            counts[eid] += 1

    out = []
    for mid, e in rows:
        if machine_id is not None and mid != machine_id:
            continue
        out.append((mid, e, float(e.debit or 0) / max(counts[e.expense_id], 1)))
    return out


def machine_totals(db: Session, from_date: Optional[date] = None, to_date: Optional[date] = None):
    """{machine_id: {hours, billed, received, expenses, parts, cost, profit}}"""
    t = defaultdict(lambda: {"hours": 0.0, "billed": 0.0, "received": 0.0, "expenses": 0.0, "parts": 0.0})

    for mid, _, share in expense_shares(db, None, from_date, to_date):
        t[mid]["expenses"] += share

    q = _in_range(db.query(MachinePartCost), MachinePartCost.txn_date, from_date, to_date)
    for p in q.all():
        t[p.machine_id]["parts"] += float(p.total_cost or 0)

    q = _in_range(db.query(MachineIncome), MachineIncome.txn_date, from_date, to_date)
    for i in q.all():
        t[i.machine_id]["received"] += float(i.amount or 0)

    q = _in_range(db.query(MachineRuntime).filter(MachineRuntime.deleted_at == None), MachineRuntime.txn_date, from_date, to_date)
    for r in q.all():
        t[r.machine_id]["billed"] += float(r.amount or 0)
        if r.start_reading is not None and r.end_reading is not None and r.end_reading >= r.start_reading:
            t[r.machine_id]["hours"] += float(r.end_reading - r.start_reading)

    for v in t.values():
        v["cost"] = v["expenses"] + v["parts"]
        v["profit"] = v["received"] - v["cost"]
    return t
