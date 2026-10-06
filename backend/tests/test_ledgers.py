from conftest import ok, bad, expense_balances_consistent
from app.models.machine_income import MachineIncome


def add_expense(c, h, d, amt, **kw):
    return ok(c.post("/expenses/", json={"txn_date": d, "description": kw.pop("desc", "x"), "expense_type_id": 1, "debit": amt, **kw}, headers=h))


def test_lists_show_newest_entries_oldest_first(api):
    c, h = api.c, api.owner
    for i in range(104):
        add_expense(c, h, f"2026-09-{(i % 28) + 1:02d}", 1)
    add_expense(c, h, "2026-10-06", 1)
    rows = ok(c.get("/expenses/", headers=h))
    assert len(rows) == 100 and rows[-1]["txn_date"] == "2026-10-06"
    assert rows == sorted(rows, key=lambda r: r["txn_date"])
    day = ok(c.get("/expenses/", params={"from_date": "2026-10-06", "to_date": "2026-10-06"}, headers=h))
    assert len(day) == 1


def test_restore_rebuilds_balances_and_mainbook_side_effects(api):
    c, h, db = api.c, api.owner, api.db
    for d in ("2026-10-01", "2026-10-02", "2026-10-03"):
        add_expense(c, h, d, 10)
    victim = ok(c.get("/expenses/", headers=h))[1]["expense_id"]
    ok(c.delete(f"/expenses/{victim}", headers=h))
    ok(c.post(f"/audit/restore/expenses/{victim}", headers=h))
    assert expense_balances_consistent(db)

    t1 = ok(c.post("/mainbook/", json={"txn_date": "2026-10-06", "description": "hire", "credit": 500, "machine_id": 1}, headers=h))["transaction_id"]
    t2 = ok(c.post("/mainbook/", json={"txn_date": "2026-09-30", "description": "float", "debit": 50, "destination": "expense"}, headers=h))["transaction_id"]
    assert expense_balances_consistent(db)
    ok(c.delete(f"/mainbook/{t1}", headers=h)); ok(c.delete(f"/mainbook/{t2}", headers=h))
    db.expire_all()
    assert db.query(MachineIncome).filter_by(transaction_id=t1).count() == 0
    ok(c.post(f"/audit/restore/mainbook_transactions/{t1}", headers=h))
    ok(c.post(f"/audit/restore/mainbook_transactions/{t2}", headers=h))
    db.expire_all()
    assert db.query(MachineIncome).filter_by(transaction_id=t1).count() == 1
    # Deleting and restoring again must not duplicate the income.
    ok(c.delete(f"/mainbook/{t1}", headers=h)); ok(c.post(f"/audit/restore/mainbook_transactions/{t1}", headers=h))
    db.expire_all()
    assert db.query(MachineIncome).filter_by(transaction_id=t1).count() == 1
    assert [float(r["balance"]) for r in ok(c.get("/mainbook/", headers=h))] == [-50.0, 450.0]
    assert expense_balances_consistent(db)


def test_mainbook_to_momo_link(api):
    c, h = api.c, api.owner
    mb = ok(c.post("/mainbook/", json={"txn_date": "2026-10-03", "description": "to momo", "debit": 400, "destination": "momo"}, headers=h))["transaction_id"]
    momo = ok(c.get("/momo/", headers=h))
    assert len(momo) == 1 and momo[0]["credit"] == 400
    mid = momo[0]["momo_id"]
    bad(c.delete(f"/momo/{mid}", headers=h), "mainbook")
    bad(c.patch(f"/momo/{mid}", json={"amount": 1}, headers=h), "mainbook")
    assert "1 skipped" in ok(c.request("DELETE", "/momo/bulk", json={"ids": [mid]}, headers=h))["message"]
    bad(c.patch(f"/mainbook/{mb}", json={"amount": 1}, headers=h), "momo")
    ok(c.patch("/mainbook/bulk-date", json={"ids": [mb], "new_date": "2026-10-04"}, headers=h))
    assert ok(c.get("/momo/", headers=h))[0]["txn_date"] == "2026-10-04"
    ok(c.delete(f"/mainbook/{mb}", headers=h))
    assert ok(c.get("/momo/", headers=h)) == []
    bad(c.post(f"/audit/restore/momo_transactions/{mid}", headers=h), "mainbook")
    ok(c.post(f"/audit/restore/mainbook_transactions/{mb}", headers=h))
    assert len(ok(c.get("/momo/", headers=h))) == 1


def test_amount_and_machine_validation(api):
    c, h, db = api.c, api.owner, api.db
    bad(c.post("/expenses/", json={"txn_date": "2026-10-06", "description": "x", "expense_type_id": 1, "debit": -5}, headers=h), "negative")
    bad(c.post("/expenses/", json={"txn_date": "2026-10-06", "description": "x", "expense_type_id": 1}, headers=h), "amount")
    ok(c.post("/expenses/", json={"txn_date": "2026-10-01", "description": "cf", "expense_type_id": 1, "is_carry_forward": True}, headers=h))
    bad(c.post("/mainbook/", json={"txn_date": "2026-10-06", "description": "x", "credit": -1}, headers=h), "negative")
    m = ok(c.post("/mainbook/", json={"txn_date": "2026-10-06", "description": "in", "credit": 100}, headers=h))["transaction_id"]
    bad(c.patch(f"/mainbook/{m}", json={"amount": -1}, headers=h), "negative")
    bad(c.post("/expenses/", json={"txn_date": "2026-10-06", "description": "x", "expense_type_id": 1, "debit": 5, "machine_ids": [999]}, headers=h), "unknown machine")
    from app.models.expenses import ExpenseMachineLink
    e = add_expense(c, h, "2026-10-06", 5, machine_ids=[1, 1])
    assert db.query(ExpenseMachineLink).filter_by(expense_id=e["expense_id"]).count() == 1


def test_bulk_date_skips_linked_expenses(api):
    c, h, db = api.c, api.owner, api.db
    from app.models.expenses import Expense
    ok(c.post("/staff/", json={"full_name": "Kwame", "currency": "GHS"}, headers=h))
    sid = ok(c.get("/loans/borrowers", headers=h))[0]["staff_id"]
    ok(c.post("/loans/", json={"staff_id": sid, "amount": 300, "issued_date": "2026-10-01"}, headers=h))
    plain = add_expense(c, h, "2026-10-02", 5)["expense_id"]
    loan_exp = db.query(Expense).filter(Expense.description.like("Loan to%")).first().expense_id
    msg = ok(c.patch("/expenses/bulk-date", json={"ids": [loan_exp, plain], "new_date": "2026-10-05"}, headers=h))["message"]
    assert "1 entry" in msg and "1 skipped" in msg
