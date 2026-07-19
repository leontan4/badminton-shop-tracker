# Badminton Shop Tracker — Demo

A standalone service-order tracker: store customers, log stringing/service
orders, and text the customer when their racket's ready. Not connected to
the Shopify store — this only handles the in-shop service workflow.

## What's built

- **Backend** (`backend/`): FastAPI + SQLite, full CRUD for
  Customers / Services / Products / Orders, plus the order workflow:
  `dropped_off → in_progress → ready_pending_confirm → ready → picked_up`
- **SMS**: mocked by default (prints to the console) so you can try the
  whole flow with zero setup. Add real Twilio credentials to send actual
  texts — see below.
- **Frontend** (`frontend/index.html`): single-page dashboard — search/add
  a customer, build an order from services + products, see the active
  order queue, and confirm-then-send the "ready" text.

## Running it locally (recommended: Docker Compose)

Same pattern as your Airflow setup -- one command spins up Postgres and the
backend together, no need to install Postgres directly on your machine:

```bash
docker compose up --build
```

That starts:
- A Postgres container (`db`) with data persisted in a Docker volume, so it
  survives restarts
- The backend (`backend`), which waits for Postgres to be healthy, seeds
  starter data, then starts the API on port 8000

Then open `frontend/index.html` in a browser same as before -- it still
just talks to `http://localhost:8000`.

To stop everything: `docker compose down` (add `-v` to also wipe the
database volume and start fresh).

To add real Twilio credentials, uncomment the three `TWILIO_*` lines in
`docker-compose.yml` and fill them in.

## Running it locally (without Docker)

If you'd rather not use Docker, or want a real Postgres/Supabase/Neon
instance instead of a local container:

**1. Backend** (uses [uv](https://docs.astral.sh/uv/) for dependency management)
```bash
cd backend
uv sync                   # creates .venv and installs deps from pyproject.toml
uv run python -m app.seed # creates the database + starter services/products
uv run uvicorn app.main:app --reload --port 8000
```
API docs will be live at http://localhost:8000/docs (FastAPI auto-generates
this — useful for poking at endpoints directly).

If you don't have `uv` installed: `pip install uv` or see the install docs
at the link above.

**2. Frontend**
Just open `frontend/index.html` in a browser. It talks to the API at
`http://localhost:8000`.

## Switching to a different Postgres instance

The Docker Compose setup above points at its own local Postgres container.
To point at a different Postgres instance instead (e.g. Supabase, Neon, or
Render Postgres) -- for local dev without Docker, or once actually
deploying -- set `DATABASE_URL` before running:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/dbname"
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

If `DATABASE_URL` isn't set, it falls back to a local SQLite file
automatically -- useful for the quickest possible local iteration without
Docker or Postgres at all.

## Enabling real SMS

The mock mode prints messages to the backend's console instead of sending
anything. To send real texts, sign up for Twilio, buy a phone number, then
set these environment variables before starting the server:

```bash
export TWILIO_ACCOUNT_SID="..."
export TWILIO_AUTH_TOKEN="..."
export TWILIO_FROM_NUMBER="+1..."
```

No code changes needed — `app/sms.py` automatically switches to real
sending once those are set.

## What's deliberately NOT in this demo

- **Auth / multi-user** — single-owner use for now, add later without
  touching the data model
- **Stock/inventory tracking** — Products table has no `stock_qty` yet
- **Analytics/reporting** — the schema supports it (prices are snapshotted
  per order line), but no charts/dashboards yet
- **Shopify integration** — completely separate system by design

## Seed data

`app/seed.py` populates:
- Services: Stringing ($30), Grip Replacement ($8)
- Products: a few strings (priced at $0, since string is bundled into the
  $30 stringing price — still tracked per order for inventory/history),
  plus a handful of retail items with prices inspired by the real
  badmintongallery.us storefront

Adjust these to match actual pricing before using this for real.

## Moving to production

- Swap SQLite for Postgres: change the one URL in `app/database.py`
- Deploy backend to Render/Railway, frontend as a static site (or folded
  into the same host)
- Add auth once there's more than one staff member using it
