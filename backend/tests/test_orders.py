"""
Run with: uv run pytest

Uses an in-memory SQLite database, isolated per test run -- doesn't touch
your real badminton.db, so it's always safe to run.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # keeps the same in-memory db across connections
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def fresh_database():
    """Creates all tables before each test, drops them after -- full isolation."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def service_id(client):
    res = client.post("/services", json={"name": "Stringing", "price": 30.0})
    return res.json()["id"]


@pytest.fixture
def customer_id(client):
    res = client.post(
        "/customers", json={"name": "Test Customer", "phone": "6519557275"}
    )
    return res.json()["id"]


# ---------------------------------------------------------------------------
# Phone normalization
# ---------------------------------------------------------------------------
def test_phone_normalized_on_create(client):
    res = client.post(
        "/customers", json={"name": "Messy Phone", "phone": "(651) 955-7275"}
    )
    assert res.json()["phone"] == "+16519557275"


def test_phone_with_existing_country_code_preserved(client):
    res = client.post(
        "/customers", json={"name": "Already Good", "phone": "+16519557275"}
    )
    assert res.json()["phone"] == "+16519557275"


def test_duplicate_phone_rejected(client):
    client.post("/customers", json={"name": "First", "phone": "6519557275"})
    res = client.post("/customers", json={"name": "Second", "phone": "(651) 955-7275"})
    assert res.status_code == 400


def test_order_item_racket_details(client, customer_id, service_id):
    res = client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{
                "service_id": service_id, "price_charged": 30.0,
                "racket_model": "Yonex Astrox 100ZZ", "string_tension": "24 lbs",
            }],
        },
    )
    item = res.json()["items"][0]
    assert item["racket_model"] == "Yonex Astrox 100ZZ"
    assert item["string_tension"] == "24 lbs"


# ---------------------------------------------------------------------------
# Order creation and totals
# ---------------------------------------------------------------------------
def test_order_total_is_sum_of_line_items(client, customer_id, service_id):
    res = client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [
                {"service_id": service_id, "price_charged": 30.0},
                {"service_id": service_id, "price_charged": 5.0, "quantity": 2},
            ],
        },
    )
    assert res.json()["total_price"] == 40.0  # 30 + (5 * 2)


def test_order_starts_dropped_off(client, customer_id, service_id):
    res = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    )
    assert res.json()["status"] == "dropped_off"


# ---------------------------------------------------------------------------
# Status workflow
# ---------------------------------------------------------------------------
def test_full_order_workflow(client, customer_id, service_id):
    order = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()
    order_id = order["id"]

    assert client.patch(f"/orders/{order_id}/start").json()["status"] == "in_progress"
    assert client.patch(f"/orders/{order_id}/mark-ready").json()["status"] == "ready_pending_confirm"

    result = client.post(f"/orders/{order_id}/send-notification").json()
    assert result["status"] == "ready"
    assert result["notification_status"] == "sent"  # mock mode always "succeeds"
    assert result["ready_at"] is not None

    assert client.patch(f"/orders/{order_id}/pickup").json()["status"] == "picked_up"


def test_cannot_start_order_twice(client, customer_id, service_id):
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]
    client.patch(f"/orders/{order_id}/start")
    res = client.patch(f"/orders/{order_id}/start")  # second time -- should fail
    assert res.status_code == 400


def test_cancel_ready_returns_to_in_progress(client, customer_id, service_id):
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]
    client.patch(f"/orders/{order_id}/start")
    client.patch(f"/orders/{order_id}/mark-ready")
    res = client.patch(f"/orders/{order_id}/cancel-ready")
    assert res.json()["status"] == "in_progress"


def test_ready_at_only_set_once(client, customer_id, service_id):
    """Idempotency check: resending shouldn't reset the ready_at timestamp."""
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]
    client.patch(f"/orders/{order_id}/start")
    client.patch(f"/orders/{order_id}/mark-ready")
    first = client.post(f"/orders/{order_id}/send-notification").json()

    # Simulate a resend from the "ready" state
    second = client.post(f"/orders/{order_id}/send-notification").json()
    assert first["ready_at"] == second["ready_at"]


# ---------------------------------------------------------------------------
# Editing
# ---------------------------------------------------------------------------
def test_update_customer_partial(client, customer_id):
    res = client.patch(f"/customers/{customer_id}", json={"name": "Fixed Name"})
    assert res.json()["name"] == "Fixed Name"
    assert res.json()["phone"] == "+16519557275"  # unchanged


def test_update_order_items_recomputes_total(client, customer_id, service_id):
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]

    res = client.put(
        f"/orders/{order_id}/items",
        json=[
            {"service_id": service_id, "price_charged": 30.0},
            {"service_id": service_id, "price_charged": 8.0},
        ],
    )
    assert res.json()["total_price"] == 38.0


def test_cannot_edit_items_after_ready(client, customer_id, service_id):
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]
    client.patch(f"/orders/{order_id}/start")
    client.patch(f"/orders/{order_id}/mark-ready")

    res = client.put(
        f"/orders/{order_id}/items",
        json=[{"service_id": service_id, "price_charged": 999.0}],
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Deletion
# ---------------------------------------------------------------------------
def test_cancel_order_is_soft(client, customer_id, service_id):
    """Cancelling should mark status='cancelled', not remove the order."""
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]

    res = client.delete(f"/orders/{order_id}")
    assert res.json()["status"] == "cancelled"
    assert res.json()["cancelled_at"] is not None

    # The order should still exist and be fetchable -- it's a log, not gone.
    still_there = client.get(f"/orders/{order_id}")
    assert still_there.status_code == 200
    assert still_there.json()["status"] == "cancelled"


def test_cannot_cancel_already_cancelled_order(client, customer_id, service_id):
    order_id = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": [{"service_id": service_id, "price_charged": 30.0}]},
    ).json()["id"]
    client.delete(f"/orders/{order_id}")
    res = client.delete(f"/orders/{order_id}")
    assert res.status_code == 400