from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SUPABASE_URL: str
    SUPABASE_JWT_SECRET: str
    DATABASE_URL: str  # Use Connection Pooling URL (PgBouncer, porta 6543) em produção IPv4


settings = Settings()

# Alias de compatibilidade para módulos que importam DATABASE_URL diretamente.
# Será removido quando app/database/connection.py for atualizado para usar settings.DATABASE_URL.
DATABASE_URL = settings.DATABASE_URL
