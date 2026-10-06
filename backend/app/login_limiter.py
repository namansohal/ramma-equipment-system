"""In-memory throttle for failed login attempts.

State lives in the process, so it resets on restart and is per-worker. That is
enough to stop online password guessing against a single small deployment.
"""
import time
import threading
from collections import defaultdict, deque

WINDOW_SECONDS = 15 * 60
MAX_FAILURES_PER_USERNAME = 8
MAX_FAILURES_PER_IP = 30

_lock = threading.Lock()
_failures = defaultdict(deque)


def _prune(q: deque, now: float):
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()


def retry_after(username: str, ip: str) -> int:
    """Seconds until another attempt is allowed, or 0 if allowed now."""
    now = time.monotonic()
    wait = 0
    with _lock:
        for key, limit in ((f"u:{username}", MAX_FAILURES_PER_USERNAME), (f"ip:{ip}", MAX_FAILURES_PER_IP)):
            q = _failures.get(key)
            if not q:
                continue
            _prune(q, now)
            if not q:
                del _failures[key]
                continue
            if len(q) >= limit:
                wait = max(wait, int(WINDOW_SECONDS - (now - q[0])) + 1)
    return wait


def record_failure(username: str, ip: str):
    now = time.monotonic()
    with _lock:
        for key in (f"u:{username}", f"ip:{ip}"):
            q = _failures[key]
            _prune(q, now)
            q.append(now)


def reset(username: str):
    with _lock:
        _failures.pop(f"u:{username}", None)
