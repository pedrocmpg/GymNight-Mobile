import logging
import sys

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SUPABASE_URL: str
    SUPABASE_JWT_SECRET: str
    DATABASE_URL: str  # Use Connection Pooling URL (PgBouncer, porta 6543) em produção IPv4

    # Rate limiting — set to "false" (string) to disable (Req 9.4)
    RATE_LIMIT_ENABLED: str = "true"

    # Admin endpoint authentication secret (Req 10.3)
    ADMIN_SECRET: str = "changeme"

    # Tombstone cleanup retention window in days (Req 10.1)
    # Valid range: [1, 3650]. Defaults to 90 days.
    TOMBSTONE_RETENTION_DAYS: int = 90


def _load_settings() -> Settings:
    """
    Instantiate Settings and exit with a descriptive error if any required
    environment variable is missing (Requirement 2.4).
    """
    try:
        return Settings()
    except ValidationError as exc:
        missing = [
            e["loc"][0]
            for e in exc.errors()
            if e.get("type") in ("missing", "value_error.missing")
        ]
        # Fall back to all fields mentioned in the error when the type check
        # doesn't match (pydantic v2 uses "missing" for required fields).
        if not missing:
            missing = [str(e["loc"][0]) for e in exc.errors()]

        logging.basicConfig(level=logging.ERROR)
        logger.error(
            "Application startup failed: the following required environment "
            "variables are not defined: %s. "
            "Set them in your environment or in a .env file and restart.",
            ", ".join(str(v) for v in missing),
        )
        sys.exit(1)


settings = _load_settings()

# Alias de compatibilidade para módulos que importam DATABASE_URL diretamente.
# Será removido quando app/database/connection.py for atualizado para usar settings.DATABASE_URL.
DATABASE_URL = settings.DATABASE_URL
