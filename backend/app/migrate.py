"""Apply pending database migrations (Alembic) at startup."""
import logging
from pathlib import Path
from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]
log = logging.getLogger(__name__)


def run_migrations():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.upgrade(cfg, "head")
    log.info("Database migrations up to date")
