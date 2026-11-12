import asyncpg


async def make_pool(database_url: str) -> asyncpg.Pool:
    # Supabase transaction pooler (port 6543) does not support named prepared statements.
    # asyncpg statement_cache_size=0 disables persistent prepared-statement caching.
    return await asyncpg.create_pool(
        dsn=database_url, min_size=1, max_size=4,
        statement_cache_size=0, command_timeout=15,
    )
