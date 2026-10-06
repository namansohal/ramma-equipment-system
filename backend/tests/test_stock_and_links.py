import sqlalchemy
from conftest import ok, bad, expense_balances_consistent
from app.models.expenses import Expense
from app.models.machine_costs import MachinePartCost
from app.models.spare_parts import SparePart
from app.models.stock import StockTransaction
from app.models.locations import Location
from app.models.users import User
from app.models.alerts import Alert
from app.stock_costs import backfill_part_costs


def part_id(db, name="Air Filter"):
    return db.query(SparePart).filter_by(name=name).first().part_id


def costs(db):
    db.expire_all()
    return sorted(float(x.total_cost) for x in db.query(MachinePartCost).all())


def test_part_costs_on_issue_delete_restore_and_backfill(api):
    c, h, db = api.c, api.owner, api.db
    part = part_id(db)
    ok(c.post("/expenses/", json={"txn_date": "2026-10-05", "description": "fuel", "expense_type_id": 1, "debit": 300}, headers=h))
    ok(c.post("/purchases/spare-part", json={"part_id": part, "quantity": 5, "unit_price": 100, "txn_date": "2026-10-01"}, headers=h))
    assert expense_balances_consistent(db)        # back-dated purchase
    iss = ok(c.post("/stock/", json={"part_id": part, "direction": "OUT", "quantity": 2, "machine_id": 1, "txn_date": "2026-10-06"}, headers=h))
    assert costs(db) == [200.0]
    assert ok(c.get("/reports/machine-profit", headers=h))["rows"][0]["parts"] == 200
    ok(c.delete(f"/stock/{iss['stock_txn_id']}", headers=h)); assert costs(db) == []
    ok(c.post(f"/audit/restore/stock_transactions/{iss['stock_txn_id']}", headers=h)); assert costs(db) == [200.0]

    loc = db.query(Location).filter(Location.is_current == True).first().location_id  # noqa: E712
    db.add(StockTransaction(part_id=part, location_id=loc, txn_date=sqlalchemy.func.date("2026-10-06"), direction="OUT", quantity=1, machine_id=2))
    db.commit()
    assert backfill_part_costs(db) == 1 and backfill_part_costs(db) == 0
    assert costs(db) == [100.0, 200.0]

    # 5 bought, 3 issued: deleting the purchase would leave stock negative.
    buy = db.query(StockTransaction).filter_by(direction="IN").first().stock_txn_id
    bad(c.delete(f"/stock/{buy}", headers=h), "can't delete")


def test_purchase_and_expense_stay_together(api):
    c, h, db = api.c, api.owner, api.db
    part = part_id(db)
    ok(c.post("/purchases/spare-part", json={"part_id": part, "quantity": 4, "unit_price": 120, "txn_date": "2026-10-02"}, headers=h))
    buy = db.query(StockTransaction).filter_by(direction="IN").first().stock_txn_id
    exp = db.query(Expense).filter(Expense.description.like("Spare part:%")).first().expense_id
    bad(c.delete(f"/expenses/{exp}", headers=h), "spare parts")
    ok(c.delete(f"/stock/{buy}", headers=h))
    db.expire_all(); assert db.get(Expense, exp).deleted_at is not None
    ok(c.post(f"/audit/restore/stock_transactions/{buy}", headers=h))
    db.expire_all(); assert db.get(Expense, exp).deleted_at is None
    assert expense_balances_consistent(db)

    mb = ok(c.post("/mainbook/", json={"txn_date": "2026-09-30", "description": "float", "debit": 1000, "destination": "expense"}, headers=h))["transaction_id"]
    mexp = db.query(Expense).filter(Expense.description.like("Cash from Mainbook%")).first().expense_id
    bad(c.delete(f"/expenses/{mexp}", headers=h), "mainbook")
    assert "2 skipped" in ok(c.request("DELETE", "/expenses/bulk", json={"ids": [exp, mexp]}, headers=h))["message"]
    ok(c.delete(f"/mainbook/{mb}", headers=h))
    bad(c.post(f"/audit/restore/expenses/{mexp}", headers=h), "mainbook")


def test_loans_cascade_and_validation(api):
    c, h, db = api.c, api.owner, api.db
    ok(c.post("/staff/", json={"full_name": "Kwame", "currency": "GHS"}, headers=h))
    sid = ok(c.get("/loans/borrowers", headers=h))[0]["staff_id"]
    bad(c.post("/loans/", json={"staff_id": sid, "amount": 0, "issued_date": "2026-10-01"}, headers=h), "more than zero")
    ok(c.post("/loans/", json={"staff_id": sid, "amount": 500, "issued_date": "2026-09-29"}, headers=h))
    lid = ok(c.get("/loans/", headers=h))[0]["loan_id"]
    bad(c.post(f"/loans/{lid}/repay", json={"amount": 501, "paid_date": "2026-09-30"}, headers=h), "still owed")
    ok(c.post(f"/loans/{lid}/repay", json={"amount": 200, "paid_date": "2026-09-30"}, headers=h))
    assert expense_balances_consistent(db)
    lexp = db.query(Expense).filter(Expense.description.like("Loan to%")).first().expense_id
    rexp = db.query(Expense).filter(Expense.description.like("Loan repayment%")).first().expense_id
    bad(c.delete(f"/expenses/{lexp}", headers=h), "repayments")
    ok(c.delete(f"/expenses/{rexp}", headers=h)); assert ok(c.get("/loans/", headers=h))[0]["remaining"] == 500
    ok(c.delete(f"/expenses/{lexp}", headers=h)); assert ok(c.get("/loans/", headers=h)) == []
    bad(c.post(f"/audit/restore/expenses/{rexp}", headers=h), "deleted loan")
    ok(c.post(f"/audit/restore/expenses/{lexp}", headers=h)); ok(c.post(f"/audit/restore/expenses/{rexp}", headers=h))
    assert ok(c.get("/loans/", headers=h))[0]["remaining"] == 300
    assert expense_balances_consistent(db)


def test_stock_list_and_minimums(api):
    c, h, db = api.c, api.owner, api.db
    part, never = part_id(db), part_id(db, "Never Bought")
    ok(c.post("/purchases/spare-part", json={"part_id": part, "quantity": 4, "unit_price": 100, "txn_date": "2026-10-01"}, headers=h))
    cur = {s["name"]: s for s in ok(c.get("/stock/current", headers=h))}
    assert cur["Never Bought"]["available"] == 0 and not cur["Never Bought"]["low"]
    assert cur["Air Filter"]["low"]                       # 4 <= default 5
    ok(c.put(f"/stock/parts/{part}/min-level", json={"min_level": 2}, headers=h))
    ok(c.put(f"/stock/parts/{never}/min-level", json={"min_level": 1}, headers=h))
    cur = {s["name"]: s for s in ok(c.get("/stock/current", headers=h))}
    assert not cur["Air Filter"]["low"] and cur["Never Bought"]["low"]
    bad(c.put(f"/stock/parts/{part}/min-level", json={"min_level": -1}, headers=h), "negative")
    emp = api.user("emp", "employee")
    assert c.put(f"/stock/parts/{part}/min-level", json={"min_level": 3}, headers=emp).status_code == 403


def test_overpay_alerts_skip_inactive_managers(api):
    c, h, db = api.c, api.owner, api.db
    api.user("mgr", "manager")
    mgr = db.query(User).filter_by(username="mgr").first(); mgr.active = False; db.commit()
    part = part_id(db)
    ok(c.post("/purchases/spare-part", json={"part_id": part, "quantity": 2, "unit_price": 100, "txn_date": "2026-10-01"}, headers=h))
    ok(c.post("/purchases/spare-part", json={"part_id": part, "quantity": 2, "unit_price": 150, "txn_date": "2026-10-02"}, headers=h))
    db.expire_all()
    assert db.query(Alert).count() >= 1 and db.query(Alert).filter_by(for_user_id=mgr.user_id).count() == 0
