"""Verify every bearer token with the issuing Supabase Auth service.

This supports both asymmetric signing keys and legacy HS256 without embedding a
JWT secret or using insecure JWT payload decoding. We may use cached JWKS later.
"""
from uuid import UUID
import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer(auto_error=False)


async def current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Supabase sign-in required", headers={"WWW-Authenticate": "Bearer"})
    settings = request.app.state.settings
    try:
        response = await request.app.state.http.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {credentials.credentials}",
                     "apikey": settings.publishable_key},
            timeout=8,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Authentication provider unavailable") from None
    if response.status_code != 200:
        raise HTTPException(401, "Invalid or expired Supabase access token")
    try:
        return UUID(response.json()["id"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Supabase user identity unavailable") from None
