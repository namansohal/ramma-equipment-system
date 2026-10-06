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
