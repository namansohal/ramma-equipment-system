"""Baseline: the schema as it was when migrations were introduced.

Tables up to this point are created by Base.metadata.create_all() on startup,
so this revision changes nothing; it only marks the starting point. Later
revisions (e.g. adding a column) build on it.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-07
"""

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
