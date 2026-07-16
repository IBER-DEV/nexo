"""
Guards against push-signals re-syncing data that a pull just wrote,
which would otherwise round-trip every pulled row straight back to the
Google Sheet it came from.
"""
from contextlib import contextmanager
from contextvars import ContextVar

_pulling: ContextVar[bool] = ContextVar("appsheet_sync_pulling", default=False)


@contextmanager
def pulling():
    token = _pulling.set(True)
    try:
        yield
    finally:
        _pulling.reset(token)


def is_pulling() -> bool:
    return _pulling.get()
