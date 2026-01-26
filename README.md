# Football Tracker - AI Training Platform

A professional-grade annotation and training platform for football analytics AI. Staff correct AI predictions, the system tracks all corrections, and exports training data to improve model accuracy over time.

## Features

- **Match Management**: Track matches with full team lineups and video metadata
- **AI Correction Interface**: Review and correct AI predictions for events and player tracking
- **40+ Event Types**: Full professional event schema matching BePro/Spiideo standards
- **Pitch Calibration**: Pixel-to-meter coordinate conversion using homography
- **Accuracy Dashboard**: Track AI performance over time with detailed metrics
- **Training Data Export**: Export corrected data in JSON/CSV for model retraining
- **Multi-user Support**: Role-based access (Admin, Analyst, Viewer)

## Architecture

```
annotation_tool/
├── backend/              # FastAPI + PostgreSQL
│   ├── app/
│   │   ├── models/       # SQLAlchemy models
│   │   ├── routers/      # API endpoints
│   │   ├── schemas/      # Pydantic schemas
│   │   └── main.py       # App entry point
│   └── scripts/          # Import/export utilities
└── frontend/             # React + TypeScript + Vite
    ├── src/
    │   ├── components/   # UI components
    │   ├── pages/        # Page components
    │   ├── services/     # API client
    │   └── stores/       # Zustand state
    └── netlify.toml      # Netlify config
```

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database credentials

# Start PostgreSQL and create database
createdb football_tracker

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env if needed (defaults to localhost:8000)

# Start development server
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Create Initial User

```bash
# Using the API docs at http://localhost:8000/docs
# POST /api/v1/auth/register with:
{
  "email": "admin@example.com",
  "username": "admin",
  "password": "your-secure-password",
  "full_name": "Admin User",
  "role": "admin"
}
```

## Deployment

### Backend on Railway

1. Create a new project on [Railway](https://railway.app)

2. Add PostgreSQL plugin to your project

3. Connect your GitHub repository

4. Set environment variables in Railway:
   - `SECRET_KEY`: Generate a secure random key
   - `CORS_ORIGINS`: Your Netlify domain (e.g., `https://your-app.netlify.app`)
   - `DATABASE_URL`: Automatically set by Railway PostgreSQL plugin

5. Railway will auto-detect the Python app and deploy

### Frontend on Netlify

1. Create a new site on [Netlify](https://netlify.com)

2. Connect your GitHub repository

3. Configure build settings:
   - Base directory: `annotation_tool/frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

4. Set environment variables:
   - `VITE_API_URL`: Your Railway backend URL (e.g., `https://your-backend.up.railway.app/api/v1`)

5. Deploy!

## Importing Data from football_tracker_v2

### Generate sample data

```bash
cd backend
python -m scripts.export_from_tracker_v2 --demo --output sample_match.json
```

### Import into database

```bash
python -m scripts.import_tracker_data --json-file sample_match.json
```

### JSON Import Format

```json
{
  "home_team": {
    "name": "Team A",
    "primary_color": "#FF0000",
    "secondary_color": "#FFFFFF"
  },
  "away_team": {
    "name": "Team B",
    "primary_color": "#0000FF",
    "secondary_color": "#FFFFFF"
  },
  "match_date": "2024-01-15",
  "fps": 25.0,
  "tracks": [...],
  "events": [...],
  "ball_positions": [...],
  "calibration": {...}
}
```

See `scripts/import_tracker_data.py` for full schema documentation.

## Event Types

The system supports 40+ event types across categories:

| Category | Events |
|----------|--------|
| Pass | Pass, Cross, Through Ball, Launch, etc. |
| Shot | Shot, Header, Free Kick, Penalty |
| Ball Control | First Touch, Receipt, Dribble, Carry |
| Defensive | Tackle, Interception, Block, Clearance |
| Duel | Aerial Duel, Ground Duel |
| Set Piece | Corner, Free Kick, Throw-in, Goal Kick |
| Physical | Sprint, High Intensity Run |
| Goalkeeper | Save, Punch, Catch, Distribution |

## Accuracy Tracking

The system calculates accuracy by comparing AI predictions to human corrections:

- **Event Detection**: % of AI events that didn't need correction
- **Team Assignment**: % of tracks with correct team classification
- **Jersey Recognition**: % of jersey numbers correctly identified
- **Overall**: Weighted average of all categories

Accuracy metrics are tracked over time to measure model improvement.

## Training Data Export

Export corrected data for model retraining:

1. Navigate to Training page
2. Select export type (All, Event Detection, Tracking, etc.)
3. Choose format (JSON or CSV)
4. Click "Create Export"

Exports include:
- Original AI predictions
- Human corrections
- Final ground truth values
- Match context and metadata

## License

Proprietary - Internal Use Only
