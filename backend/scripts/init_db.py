"""
Database initialization script.

Creates all tables and an initial admin user.

Usage:
    python -m scripts.init_db
"""

import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine, Base, SessionLocal
from app.models.user import User, UserRole
from app.auth import get_password_hash


def init_database():
    """Initialize database with tables and admin user."""

    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

    db = SessionLocal()
    try:
        # Check if admin exists
        admin = db.query(User).filter(User.username == "admin").first()

        if not admin:
            print("\nCreating admin user...")
            admin = User(
                email="admin@footballtracker.local",
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("Admin user created!")
            print("  Username: admin")
            print("  Password: admin123")
            print("  IMPORTANT: Change this password after first login!")
        else:
            print("\nAdmin user already exists.")

    finally:
        db.close()

    print("\nDatabase initialization complete!")


if __name__ == "__main__":
    init_database()
