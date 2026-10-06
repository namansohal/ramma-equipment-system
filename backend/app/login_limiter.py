"""Throttle for failed login attempts, stored in the database so the counts
survive restarts and redeploys."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.login_attempts import FailedLogin

WINDOW = timedelta(minutes=15)
MAX_FAILURES_PER_USERNAME = 8
MAX_FAILURES_PER_IP = 30


def _now():
    return datetime.now(timezone.utc)


def _aware(dt):
    # SQLite (tests) returns naive datetimes; Postgres returns aware ones.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def retry_after(db: Session, username: str, ip: str) -> int:
    """Seconds until another attempt is allowed, or 0 if allowed now."""
    since = _now() - WINDOW
    wait = 0
    for key, limit in ((f"u:{username}", MAX_FAILURES_PER_USERNAME), (f"ip:{ip}", MAX_FAILURES_PER_IP)):
        q = db.query(FailedLogin).filter(FailedLogin.key == key, FailedLogin.at > since)
        if q.count() >= limit:
            oldest = _aware(db.query(func.min(FailedLogin.at)).filter(FailedLogin.key == key, FailedLogin.at > since).scalar())
            wait = max(wait, int((oldest + WINDOW - _now()).total_seconds()) + 1)
    return wait


def record_failure(db: Session, username: str, ip: str):
    now = _now()
    db.query(FailedLogin).filter(FailedLogin.at < now - WINDOW).delete(synchronize_session=False)
    db.add_all([FailedLogin(key=f"u:{username}", at=now), FailedLogin(key=f"ip:{ip}", at=now)])
    db.commit()


def reset(db: Session, username: str):
    db.query(FailedLogin).filter(FailedLogin.key == f"u:{username}").delete(synchronize_session=False)
    db.commit()
