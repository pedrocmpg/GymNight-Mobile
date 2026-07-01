"""
Structured logging configuration using structlog.

Produces single-line JSON log entries with fields:
  level, timestamp (ISO 8601 UTC), message, correlation_id

Supports LOG_LEVEL env var (DEBUG, INFO, WARNING, ERROR; default INFO).

When LOG_LEVEL=DEBUG, request bodies are included in log entries with:
  - JWT tokens, passwords, and API keys redacted
  - Bodies exceeding 10,000 characters truncated with [truncated]

Requirements: 11.4, 11.6
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from typing import Any

import structlog

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BODY_MAX_LENGTH = 10_000
_TRUNCATED_MARKER = "[truncated]"

# Regex patterns for sensitive field names (case-insensitive key matching)
_SENSITIVE_KEY_PATTERNS = re.compile(
    r"(password|passwd|secret|token|api[_-]?key|apikey|jwt|authorization|auth_token)",
    re.IGNORECASE,
)

# Patterns for detecting sensitive *values* (JWT bearer tokens, etc.)
# A JWT is three base64url segments separated by dots
_JWT_VALUE_PATTERN = re.compile(
    r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*"
)

# ---------------------------------------------------------------------------
# Sensitive field sanitisation
# ---------------------------------------------------------------------------


def _is_sensitive_key(key: str) -> bool:
    """Return True if *key* looks like it holds a sensitive value."""
    return bool(_SENSITIVE_KEY_PATTERNS.search(str(key)))


def _sanitize_value(value: Any) -> Any:
    """Replace JWT tokens inside a string value with a redacted marker."""
    if isinstance(value, str):
        return _JWT_VALUE_PATTERN.sub("[REDACTED]", value)
    return value


def sanitize_body(body: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively walk a parsed request body dict and:
      - Replace the *value* of any sensitive key with '[REDACTED]'
      - Strip JWT patterns from non-sensitive string values

    Returns a new dict; the original is not mutated.
    """
    result: dict[str, Any] = {}
    for key, value in body.items():
        if _is_sensitive_key(key):
            result[key] = "[REDACTED]"
        elif isinstance(value, dict):
            result[key] = sanitize_body(value)
        elif isinstance(value, list):
            result[key] = [
                sanitize_body(item) if isinstance(item, dict) else _sanitize_value(item)
                for item in value
            ]
        else:
            result[key] = _sanitize_value(value)
    return result


def prepare_body_for_log(raw_body: str | bytes) -> str:
    """
    Prepare a request body for inclusion in a DEBUG log entry.

    Steps:
      1. Decode bytes to str if necessary.
      2. Attempt JSON parse; if it fails, treat as plain text.
      3. Sanitize sensitive fields.
      4. Re-serialize to a single-line JSON string.
      5. Truncate to _BODY_MAX_LENGTH characters, appending _TRUNCATED_MARKER.

    Returns a string safe to log.
    """
    if isinstance(raw_body, bytes):
        try:
            text = raw_body.decode("utf-8", errors="replace")
        except Exception:
            text = repr(raw_body)
    else:
        text = raw_body

    # Attempt JSON parse for field-level sanitisation
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            sanitized = sanitize_body(parsed)
            text = json.dumps(sanitized, ensure_ascii=False, separators=(",", ":"))
        else:
            # JSON array or primitive — just strip JWT patterns from the raw text
            text = _JWT_VALUE_PATTERN.sub("[REDACTED]", text)
    except (json.JSONDecodeError, ValueError):
        # Not JSON — strip JWT patterns from raw text
        text = _JWT_VALUE_PATTERN.sub("[REDACTED]", text)

    # Truncate if necessary
    if len(text) > _BODY_MAX_LENGTH:
        text = text[:_BODY_MAX_LENGTH] + _TRUNCATED_MARKER

    return text


# ---------------------------------------------------------------------------
# structlog processors
# ---------------------------------------------------------------------------


def _add_log_level(
    logger: Any, method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Add a 'level' field derived from the log method name."""
    event_dict.setdefault("level", method.upper())
    return event_dict


def _rename_event_to_message(
    logger: Any, method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Rename structlog's 'event' key to 'message' for Req 11.4 compliance."""
    if "event" in event_dict:
        event_dict["message"] = event_dict.pop("event")
    return event_dict


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _resolve_log_level() -> int:
    """Resolve the LOG_LEVEL env var to a stdlib logging level integer."""
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper().strip()
    level = getattr(logging, level_name, None)
    if not isinstance(level, int):
        # Fall back to INFO for unrecognised values
        level = logging.INFO
    return level


def configure_logging() -> None:
    """
    Configure structlog and the stdlib logging root logger.

    Call this once at application startup (e.g., in app/main.py).

    Output format: single-line JSON with fields
      level, timestamp (ISO 8601 UTC), message, correlation_id, …extra fields
    """
    log_level = _resolve_log_level()

    # ------------------------------------------------------------------
    # 1. Configure stdlib logging so that third-party libraries whose
    #    records flow through the root logger are also rendered as JSON.
    # ------------------------------------------------------------------
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
        force=True,  # Override any previously set handlers
    )

    # ------------------------------------------------------------------
    # 2. Build the structlog processor chain.
    #
    #    Chain (innermost → outermost):
    #      a. merge_contextvars  — pulls correlation_id (and anything else
    #                              bound via bind_contextvars) into the event
    #      b. add_log_level      — adds 'level' field
    #      c. TimeStamper        — adds 'timestamp' in ISO 8601 UTC
    #      d. rename event→msg   — satisfies Req 11.4 field naming
    #      e. JSONRenderer       — serialises to single-line JSON
    # ------------------------------------------------------------------
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        _add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _rename_event_to_message,
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Return a structlog bound logger.

    Usage::

        from app.core.logging import get_logger
        log = get_logger(__name__)
        log.info("something happened", user_id="abc")
    """
    return structlog.get_logger(name)
