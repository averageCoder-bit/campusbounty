"""Independent localhost Byte API; G4.6 Supabase/Clerk auth not required yet.
Run: uvicorn app.byte_dev:app --reload --host 127.0.0.1 --port 8001
"""
from pathlib import Path
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parents[1] / ".env")
from .byte_mentor import router  # noqa: E402

app = FastAPI(title="CampusBounty Byte Mentor (Local Dev)")
allowed = ["http://localhost:8080", "http://127.0.0.1:8080",
           "http://localhost:5173", "http://127.0.0.1:5173"]
allowed.extend(s.strip() for s in os.getenv("BYTE_DEV_ORIGINS", "").split(",") if s.strip())
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"], allow_credentials=False)
app.include_router(router)

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "byte-mentor-local"}
