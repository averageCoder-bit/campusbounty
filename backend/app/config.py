from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    publishable_key: str
    database_url: str
    cors_origins: tuple[str, ...]


def get_settings() -> Settings:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    db = os.getenv("DATABASE_URL", "")
    if not url.startswith("https://") or not key or not db:
        raise RuntimeError("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and DATABASE_URL.")
    origins = tuple(x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip())
    if "*" in origins:
        raise RuntimeError("Do not configure wildcard CORS with authenticated endpoints")
    return Settings(url, key, db, origins)
