"""Alembic environment: reuses the app's engine so migrations connect exactly
like the app does (same URL and connection settings)."""
from alembic import context
from app.database import engine, Base
import app.models  # noqa: F401  registers every table on Base.metadata
from app.models import (  # noqa: F401
    locations, machines, users, spare_parts, expenses, stock, audit, downtime, mainbook,
    loans, staff, links, machine_costs, machine_income, alerts, runtime, momo, customers,
)

target_metadata = Base.metadata


def run_migrations_online():
    connectable = context.config.attributes.get("connection")
    if connectable is not None:
        context.configure(connection=connectable, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
