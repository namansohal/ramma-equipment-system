from conftest import ok, bad


def test_login_is_case_insensitive_and_tokens_follow_user_id(api):
    c = api.c
    ok(c.post("/users/", json={"full_name": "Dheeraj", "username": "Dheeraj", "password": "dheerajpw1",
                               "role_id": api.roles["owner"]}, headers=api.owner))
    api.login("dheeraj", "dheerajpw1")
    api.login("  DHEERAJ ", "dheerajpw1")

    emp = api.user("emp", "employee", "emppass12")
    # Renaming then letting someone else take the old name must not hand them the old token.
    ok(c.post("/users/change-username", json={"new_username": "emp2"}, headers=emp))
    ok(c.post("/users/", json={"full_name": "New", "username": "emp", "password": "newpass123",
                               "role_id": api.roles["employee"]}, headers=api.owner))
    assert ok(c.get("/auth/me", headers=emp))["full_name"] == "Emp"


def test_password_change_revokes_old_tokens(api):
    c = api.c
    emp = api.user("emp", "employee", "emppass12")
    r = ok(c.post("/users/change-password", json={"old_password": "emppass12", "new_password": "emppass99"}, headers=emp))
    assert c.get("/auth/me", headers=emp).status_code == 401
    assert c.get("/auth/me", headers={"Authorization": "Bearer " + r["access_token"]}).status_code == 200


def test_failed_logins_are_throttled(api):
    codes = [api.c.post("/auth/login", data={"username": "owner", "password": "wrong"}).status_code for _ in range(9)]
    assert codes[:8] == [401] * 8 and codes[8] == 429
    assert api.c.post("/auth/login", data={"username": "owner", "password": "ChangeMe2026!"}).status_code == 429


def test_role_limits(api):
    c = api.c
    emp = api.user("emp", "employee")
    viewer = api.user("view", "viewer")
    assert c.post("/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers=emp).status_code == 403
    assert c.request("DELETE", "/expenses/bulk", json={"ids": [1]}, headers=emp).status_code == 403
    assert c.get("/reports/machine-profit", headers=emp).status_code == 403
    assert c.get("/customers/", headers=emp).status_code == 403
    assert c.get("/audit/?limit=5000", headers=api.owner).status_code == 422
    for url in ("/expenses/", "/mainbook/", "/momo/", "/loans/", "/runtime/", "/machine-detail/1", "/expenses/types"):
        assert c.get(url, headers=viewer).status_code == 403, url
        assert c.get(url, headers=emp).status_code == 200, url
    for url in ("/stock/current", "/machines/", "/downtime/", "/alerts/", "/auth/me"):
        assert c.get(url, headers=viewer).status_code == 200, url


def test_removed_usernames_and_codes_can_be_reused(api):
    from app.models.users import User
    c, emp_role = api.c, api.roles["employee"]
    u = ok(c.post("/users/", json={"full_name": "John", "username": "john", "password": "johnpass1",
                                   "role_id": emp_role, "employee_code": "EMP9"}, headers=api.owner))
    ok(c.delete(f"/users/{u['user_id']}", headers=api.owner))
    ok(c.post("/users/", json={"full_name": "John 2", "username": "john", "password": "johnpass2",
                               "role_id": emp_role, "employee_code": "EMP9"}, headers=api.owner))
    # Accounts removed before the fix still hold their name/code.
    api.db.add(User(full_name="Old", username="ama", password_hash="x", role_id=emp_role, active=False, employee_code="EMP7"))
    api.db.commit()
    ok(c.post("/users/", json={"full_name": "Ama", "username": "ama", "password": "amapass12",
                               "role_id": emp_role, "employee_code": "EMP7"}, headers=api.owner))
    bad(c.post("/users/", json={"full_name": "Dup", "username": "john", "password": "duppass12", "role_id": emp_role}, headers=api.owner))


def test_excel_export_escapes_formulas(api):
    from app.routes.reports import _excel_safe
    assert _excel_safe("=HYPERLINK(1)") == "'=HYPERLINK(1)"
    assert _excel_safe("ok") == "ok" and _excel_safe(-5) == -5


def test_failed_logins_are_kept_in_the_database(api):
    from app.models.login_attempts import FailedLogin
    for _ in range(3):
        api.c.post("/auth/login", data={"username": "owner", "password": "wrong"})
    api.db.expire_all()
    assert api.db.query(FailedLogin).filter_by(key="u:owner").count() == 3   # survives a restart
    api.login("owner", "ChangeMe2026!")                                       # success clears the count
    api.db.expire_all()
    assert api.db.query(FailedLogin).filter_by(key="u:owner").count() == 0


def test_passwords_hashed_by_the_old_library_still_work(api):
    from app.models.users import User
    from app.auth import hash_password
    # passlib's bcrypt format ($2b$) is what bcrypt itself produces and reads.
    u = api.db.query(User).filter_by(username="owner").first()
    assert u.password_hash.startswith("$2b$")
    long_pw = "p" * 80                                   # bcrypt reads the first 72 bytes
    u.password_hash = hash_password(long_pw); api.db.commit()
    api.login("owner", long_pw)


def test_site_switch_is_owner_only_and_scopes_reports(api):
    c, h = api.c, api.owner
    sites = {l["name"]: l for l in ok(c.get("/locations/", headers=h))}
    assert sites["Kade"]["is_current"]
    ok(c.post("/expenses/", json={"txn_date": "2026-10-01", "description": "kade fuel", "expense_type_id": 1, "debit": 100}, headers=h))
    mgr = api.user("mgr", "manager")
    assert c.post(f"/locations/{sites['Anyanso']['location_id']}/make-current", headers=mgr).status_code == 403
    ok(c.post(f"/locations/{sites['Anyanso']['location_id']}/make-current", headers=h))
    assert {l["name"]: l for l in ok(c.get("/locations/", headers=h))}["Anyanso"]["is_current"]
    ok(c.post("/expenses/", json={"txn_date": "2026-10-02", "description": "anyanso fuel", "expense_type_id": 1, "debit": 40}, headers=h))
    rep = ok(c.get("/reports/expenses", headers=h))
    assert rep["total"] == 40 and [r["description"] for r in rep["rows"]] == ["Anyanso Fuel"], rep
    assert len(ok(c.get("/expenses/", headers=h))) == 1                     # ledger agrees with report


def test_health_endpoint_reads_the_database_and_needs_no_login(api):
    r = api.c.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
