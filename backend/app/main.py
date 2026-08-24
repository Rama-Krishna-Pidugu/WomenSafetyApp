from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging import logger
from app.core.firebase import initialize_firebase
from app.db.base import Base
from app.db.session import engine
from app.api import api_v1_router
from app.middleware import RequestLoggingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Aegis Modular Monolith Backend...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database ORM tables created/verified successfully.")
    except Exception as err:
        logger.warning(f"Database table creation warning: {err}")

    initialize_firebase()
    yield
    logger.info("Shutting down Aegis Modular Monolith Backend...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-Ready Modular Monolith FastAPI Backend for AI Women Safety App.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "title": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
