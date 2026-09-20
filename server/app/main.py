from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.admin import setup_admin
from app.api.auth import router as auth_router
from app.api.domain import router as domain_router
from app.core.config import settings

app = FastAPI(title="Koober API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)
app.include_router(auth_router)
app.include_router(domain_router)
setup_admin(app)


@app.get("/health")
async def health():
    return {"ok": True}
