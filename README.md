# Koober

Parent-managed kids pronunciation app: FastAPI + PostgreSQL (`server/`) and Expo Router (`client/`).

## Prerequisites

- Docker
- Python 3.12+
- Node 20+

## Start Postgres and Mailhog

```bash
docker compose up -d
```

Mailhog UI: http://localhost:8025

## Server

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

Admin portal: http://localhost:8000/admin  
Default credentials: `admin` / `koober-admin` (override with `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`)

Demo API login after seed: `parent@koober.dev` / `koober-dev`

## Client

```bash
cd client
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` in `client/.env` (currently `http://192.168.0.144:8000` for a physical device). Restart Expo after changing it. On iOS Simulator use `http://127.0.0.1:8000`.

## v1 notes

Speech-to-text and pronunciation scoring are stubbed behind provider interfaces. Parent Hub tips are static (not in the ERD).
