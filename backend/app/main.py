"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.routers import auth, teams, players, matches, tracks, events, calibration, corrections, training, accuracy
from app.models.user import User, UserRole
from app.auth import get_password_hash

settings = get_settings()


def create_initial_admin():
    """Create initial admin user if no users exist."""
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            admin = User(
                email="admin@footballtracker.com",
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("Initial admin user created: admin / admin123")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    # Create initial admin if needed
    create_initial_admin()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    description="AI Training Platform for Football Analytics - Correct AI predictions, train models, track accuracy",
    lifespan=lifespan,
)

# CORS middleware
cors_origins = [origin.strip() for origin in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(players.router, prefix="/api/v1")
app.include_router(matches.router, prefix="/api/v1")
app.include_router(tracks.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(calibration.router, prefix="/api/v1")
app.include_router(corrections.router, prefix="/api/v1")
app.include_router(training.router, prefix="/api/v1")
app.include_router(accuracy.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.api_version,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
