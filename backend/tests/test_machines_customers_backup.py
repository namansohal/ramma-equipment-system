import io
import json
import zipfile
from conftest import ok, bad


def test_machine_profit_and_cost_reports(api):
    c, h = api.c, api.owner
    ok(c.post("/expenses/", json={"txn_date": "2026-10-02", "description": "diesel", "expense_type_id": 1, "debit": 1000, "machine_ids": [1, 2]}, headers=h))
    ok(c.post("/expenses/", json={"txn_date": "2026-09-15", "description": "old", "expense_type_id": 1, "debit": 999, "machine_ids": [1]}, headers=h))
    ok(c.post("/mainbook/", json={"txn_date": "2026-10-03", "description": "hire", "credit": 3000, "machine_id": 1}, headers=h))
    ok(c.post("/runtime/", json={"machine_id": 1, "txn_date": "2026-10-03", "customer_name": "Asante", "start_reading": 100, "end_reading": 106.5, "amount": 2500}, headers=h))
    r = ok(c.get("/reports/machine-profit", params={"from_date": "2026-10-01", "to_date": "2026-10-31"}, headers=h))
    m1, m2 = r["rows"][0], r["rows"][1]
    assert m1["expenses"] == 500 and m2["expenses"] == 500           # shared expense split evenly
    assert m1["received"] == 3000 and m1["billed"] == 2500 and m1["hours"] == 6.5
    assert m1["profit"] == 2500 and m2["profit"] == -500 and r["totals"]["profit"] == 2000
    detail = ok(c.get("/machine-detail/1", headers=h))
    assert detail["summary"]["total_expense"] == 1499 and detail["summary"]["total_income"] == 3000
    mc = {x["machine"]: x["total"] for x in ok(c.get("/reports/machine-cost", headers=h))["rows"]}
    mp = {x["machine"]: x["cost"] for x in ok(c.get("/reports/machine-profit", headers=h))["rows"] if x["cost"]}
    assert mc == mp
    x = c.get("/reports/export/machine-profit", headers=h)
    assert x.status_code == 200 and len(x.content) > 1000


def test_runtime_readings_and_restore(api):
    c, h = api.c, api.owner
    ok(c.post("/runtime/", json={"machine_id": 1, "txn_date": "2026-10-03", "customer_name": "A", "start_reading": 100, "end_reading": 110, "amount": 50}, headers=h))
    rid = ok(c.get("/runtime/", headers=h))[0]["runtime_id"]
    bad(c.patch(f"/runtime/{rid}", json={"end_reading": 90}, headers=h), "closing")
    ok(c.patch(f"/runtime/{rid}", json={"end_reading": None}, headers=h))
    assert ok(c.get("/runtime/", headers=h))[0]["end_reading"] is None
    ok(c.patch(f"/runtime/{rid}", json={"amount": 60}, headers=h))
    assert ok(c.get("/runtime/", headers=h))[0]["start_reading"] == 100
    ok(c.delete(f"/runtime/{rid}", headers=h)); assert ok(c.get("/runtime/", headers=h)) == []
    ok(c.post(f"/audit/restore/machine_runtime/{rid}", headers=h)); assert len(ok(c.get("/runtime/", headers=h))) == 1


def test_downtime_edit_delete_restore(api):
    c, h = api.c, api.owner
    bad(c.post("/downtime/", json={"machine_id": 2, "start_date": "2026-10-01", "reason": "  "}, headers=h), "reason")
    d = ok(c.post("/downtime/", json={"machine_id": 2, "start_date": "2026-10-01", "reason": "Leak"}, headers=h))["downtime_id"]
    ok(c.patch(f"/downtime/{d}", json={"reason": "Hydraulic leak", "end_date": "2026-10-03"}, headers=h))
    bad(c.patch(f"/downtime/{d}", json={"end_date": "2026-09-01"}, headers=h), "before")
    ok(c.patch(f"/downtime/{d}", json={"end_date": None}, headers=h))
    d2 = ok(c.post("/downtime/", json={"machine_id": 2, "start_date": "2026-10-04", "end_date": "2026-10-05", "reason": "Tyre"}, headers=h))["downtime_id"]
    bad(c.patch(f"/downtime/{d2}", json={"end_date": None}, headers=h), "ongoing")
    ok(c.delete(f"/downtime/{d}", headers=h))
    ok(c.post("/downtime/", json={"machine_id": 2, "start_date": "2026-10-06", "reason": "New"}, headers=h))
    bad(c.post(f"/audit/restore/machine_downtime/{d}", headers=h), "ongoing")


def test_staff_validation_and_restore(api):
    c, h = api.c, api.owner
    bad(c.post("/staff/", json={"full_name": " ", "currency": "GHS"}, headers=h), "name")
    ok(c.post("/staff/", json={"full_name": "Kwame", "currency": "GHS"}, headers=h))
    sid = ok(c.get("/staff/", headers=h))[0]["staff_id"]
    bad(c.patch(f"/staff/{sid}", json={"full_name": "  "}, headers=h), "empty")
    bad(c.patch(f"/staff/{sid}", json={"currency": "USD"}, headers=h), "currency")
    bad(c.patch(f"/staff/{sid}", json={"monthly_salary": -1}, headers=h), "negative")
    ok(c.delete(f"/staff/{sid}", headers=h)); assert ok(c.get("/staff/", headers=h)) == []
    ok(c.post(f"/audit/restore/staff/{sid}", headers=h)); assert len(ok(c.get("/staff/", headers=h))) == 1


def test_customer_billing(api):
    c, h = api.c, api.owner
    ok(c.post("/runtime/", json={"machine_id": 1, "txn_date": "2026-10-01", "customer_name": "Asante Construction", "start_reading": 100, "end_reading": 108, "amount": 2000}, headers=h))
    ok(c.post("/runtime/", json={"machine_id": 2, "txn_date": "2026-10-03", "customer_name": "  asante   construction ", "amount": 1500}, headers=h))
    ok(c.post("/runtime/", json={"machine_id": 3, "txn_date": "2026-10-02", "customer_name": "Kade Road", "amount": 800}, headers=h))
    ok(c.post("/customers/payments", json={"customer_name": "Asante construction", "amount": 1000, "txn_date": "2026-10-03", "method": "momo"}, headers=h))
    bad(c.post("/customers/payments", json={"customer_name": "X", "amount": -5, "txn_date": "2026-10-03"}, headers=h))
    lst = ok(c.get("/customers/", headers=h))
    a = lst[0]
    assert (a["key"], a["billed"], a["paid"], a["owed"], a["jobs"], a["hours"]) == ("asante construction", 3500, 1000, 2500, 2, 8)
    d = ok(c.get("/customers/detail", params={"key": "Asante Construction"}, headers=h))
    assert [l["owed"] for l in d["lines"]] == [2000, 3500, 2500]
    pid = d["lines"][-1]["id"]
    ok(c.delete(f"/customers/payments/{pid}", headers=h)); assert ok(c.get("/customers/", headers=h))[0]["owed"] == 3500
    ok(c.post(f"/audit/restore/customer_payments/{pid}", headers=h)); assert ok(c.get("/customers/", headers=h))[0]["owed"] == 2500


def test_full_backup_is_owner_only_and_has_no_password_hashes(api):
    c, h = api.c, api.owner
    mgr = api.user("mgr", "manager")
    assert c.get("/backup/export", headers=mgr).status_code == 403
    r = c.get("/backup/export", headers=h)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    users = json.loads(z.read("users.json"))
    assert users and all("password_hash" not in u for u in users)
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["row_counts"]["machines"] == 12 and "expenses.json" in z.namelist()


def test_migrations_are_applied(api):
    from sqlalchemy import text
    from app.database import engine
    with engine.connect() as conn:
        assert conn.execute(text("select version_num from alembic_version")).scalar() == "0001_baseline"
