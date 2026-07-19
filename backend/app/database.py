import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Reads DATABASE_URL from the environment if set (e.g. a Postgres connection
# string), otherwise falls back to a local SQLite file -- no setup needed
# for local dev, but a one-line switch to Postgres for real deployment:
#   export DATABASE_URL="postgresql://user:password@host:5432/dbname"
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./badminton.db")

# check_same_thread is only needed/valid for SQLite
connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
