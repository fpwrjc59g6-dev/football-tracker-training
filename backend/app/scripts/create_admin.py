"""Create initial admin user."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.auth import get_password_hash


def create_admin():
    """Create the initial admin user."""
    db = SessionLocal()

    try:
        # Check if admin exists
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print("Admin user already exists!")
            return

        # Create admin user
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
        print("Admin user created successfully!")
        print("Username: admin")
        print("Password: admin123")
        print("\n*** CHANGE THIS PASSWORD IMMEDIATELY ***")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
