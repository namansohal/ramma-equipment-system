from app.database import SessionLocal
from app.models.locations import Location
from app.models.machines import Machine
from app.models.users import Role, User
from app.auth import hash_password


def seed():
    db = SessionLocal()
    try:
        # ── Locations ──────────────────────────────────────────
        if not db.query(Location).first():
            locations = [
                Location(name="Kade",    is_current=True),
                Location(name="Anyanso", is_current=False),
                Location(name="Kumasi",  is_current=False),
            ]
            db.add_all(locations)
            db.commit()
            print("✓ Locations created")
        else:
            print("- Locations already exist, skipping")

        # ── Machines ───────────────────────────────────────────
        if not db.query(Machine).first():
            kade = db.query(Location).filter(Location.name == "Kade").first()
            machines = [
                Machine(code="H7",  location_id=kade.location_id),
                Machine(code="H8",  location_id=kade.location_id),
                Machine(code="H9",  location_id=kade.location_id),
                Machine(code="H10", location_id=kade.location_id),
                Machine(code="H11", location_id=kade.location_id),
                Machine(code="H12", location_id=kade.location_id),
                Machine(code="H13", location_id=kade.location_id),
                Machine(code="H14", location_id=kade.location_id),
                Machine(code="H15", location_id=kade.location_id),
                Machine(code="H16", location_id=kade.location_id),
                Machine(code="H17", location_id=kade.location_id),
                Machine(code="H18", location_id=kade.location_id),
            ]
            db.add_all(machines)
            db.commit()
            print("✓ Machines created")
        else:
            print("- Machines already exist, skipping")

        # ── Roles ──────────────────────────────────────────────
        if not db.query(Role).first():
            roles = [
                Role(name="owner"),
                Role(name="manager"),
                Role(name="employee"),
                Role(name="store_keeper"),
            ]
            db.add_all(roles)
            db.commit()
            print("✓ Roles created")
        else:
            print("- Roles already exist, skipping")

        # ── Owner account ──────────────────────────────────────
        if not db.query(User).first():
            owner_role = db.query(Role).filter(Role.name == "owner").first()
            owner = User(
                employee_code = "EMP001",
                full_name     = "Owner",
                username      = "owner",
                password_hash = hash_password("ChangeMe2026!"),
                role_id       = owner_role.role_id,
                active        = True,
            )
            db.add(owner)
            db.commit()
            print("✓ Owner account created")
            print("  username: owner")
            print("  password: ChangeMe2026!")
            print("  ⚠ Change this password immediately after first login")
        else:
            print("- Users already exist, skipping")

    finally:
        db.close()

def seed_expense_types():
    db = SessionLocal()
    try:
        from app.models.expenses import ExpenseType
        if not db.query(ExpenseType).first():
            types = [
                ExpenseType(code="common",       label="Common"),
                ExpenseType(code="machine",       label="Machine"),
                ExpenseType(code="spare_part",    label="Spare Part"),
                ExpenseType(code="loan",          label="Loan"),
                ExpenseType(code="cash_receipt",  label="Cash Receipt"),
            ]
            db.add_all(types)
            db.commit()
            print("✓ Expense types created")
        else:
            print("- Expense types already exist, skipping")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
    seed_expense_types()