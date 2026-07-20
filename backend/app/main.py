from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from . import models, schemas
from .database import engine, get_db
from .sms import send_ready_sms
from .email_utils import send_owner_email

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Badminton Service Tracker")

# Allow the frontend (served separately) to call this API during local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@app.post("/customers", response_model=schemas.CustomerOut)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Customer).filter(models.Customer.phone == customer.phone).first()
    if existing:
        raise HTTPException(
            400, f"A customer with this phone number already exists: {existing.name}"
        )
    db_customer = models.Customer(**customer.dict())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.get("/customers", response_model=List[schemas.CustomerOut])
def list_customers(search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Customer)
    if search:
        query = query.filter(
            (models.Customer.name.ilike(f"%{search}%"))
            | (models.Customer.phone.ilike(f"%{search}%"))
        )
    return query.order_by(models.Customer.name).all()


@app.get("/customers/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


@app.patch("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(
    customer_id: int, update: schemas.CustomerUpdate, db: Session = Depends(get_db)
):
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    for field, value in update.dict(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """
    Deletes a customer -- but only if they have zero orders. Unlike order
    cancellation (which is deliberately a soft-cancel to preserve revenue
    history), a customer with real order history should never be hard-
    deleted, since that would corrupt past revenue/analytics data tied to
    them. This only exists to clean up genuine mistakes (e.g. an
    accidental duplicate customer created with no orders yet).
    """
    customer = db.query(models.Customer).get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    order_count = db.query(models.Order).filter(models.Order.customer_id == customer_id).count()
    if order_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete '{customer.name}' -- they have {order_count} order(s) on record. "
            "Deleting them would corrupt that order/revenue history.",
        )
    db.delete(customer)
    db.commit()
    return {"deleted": True, "customer_id": customer_id}


# ---------------------------------------------------------------------------
# Services (the labor catalog, e.g. Stringing -> $30)
# ---------------------------------------------------------------------------
@app.post("/services", response_model=schemas.ServiceOut)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    db_service = models.Service(**service.dict())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@app.get("/services", response_model=List[schemas.ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.query(models.Service).filter(models.Service.active == True).all()


# ---------------------------------------------------------------------------
# Products (physical goods: strings, grips, shuttlecocks, bags, rackets)
# ---------------------------------------------------------------------------
@app.post("/products", response_model=schemas.ProductOut)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/products", response_model=List[schemas.ProductOut])
def list_products(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Product).filter(models.Product.active == True)
    if category:
        query = query.filter(models.Product.category == category)
    return query.all()


# ---------------------------------------------------------------------------
# Orders + the status workflow
# ---------------------------------------------------------------------------
@app.post("/orders", response_model=schemas.OrderOut)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).get(order.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")

    total = sum(item.price_charged * item.quantity for item in order.items)

    db_order = models.Order(
        customer_id=order.customer_id,
        notes=order.notes,
        total_price=total,
        status="dropped_off",
    )
    db.add(db_order)
    db.flush()  # get db_order.id before committing

    for item in order.items:
        db.add(models.OrderItem(order_id=db_order.id, **item.dict()))

    db.commit()
    db.refresh(db_order)
    send_owner_email(f"New order #{db_order.id} created", db_order)
    return db_order


@app.get("/orders", response_model=List[schemas.OrderOut])
def list_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    return query.order_by(models.Order.created_at.asc()).all()


@app.get("/orders/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order


def _get_order_or_404(order_id: int, db: Session) -> models.Order:
    order = db.query(models.Order).get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@app.patch("/orders/{order_id}/start", response_model=schemas.OrderOut)
def start_order(order_id: int, db: Session = Depends(get_db)):
    """dropped_off -> in_progress"""
    order = _get_order_or_404(order_id, db)
    if order.status != "dropped_off":
        raise HTTPException(400, f"Order is '{order.status}', cannot start")
    order.status = "in_progress"
    db.commit()
    db.refresh(order)
    return order


@app.patch("/orders/{order_id}/mark-ready", response_model=schemas.OrderOut)
def mark_ready(order_id: int, db: Session = Depends(get_db)):
    """
    in_progress -> ready_pending_confirm
    This does NOT send the SMS yet -- it just moves the order into a state
    where staff can review and confirm before the text actually goes out.
    """
    order = _get_order_or_404(order_id, db)
    if order.status != "in_progress":
        raise HTTPException(400, f"Order is '{order.status}', cannot mark ready")
    order.status = "ready_pending_confirm"
    db.commit()
    db.refresh(order)
    return order


@app.post("/orders/{order_id}/send-notification", response_model=schemas.OrderOut)
def send_notification(order_id: int, db: Session = Depends(get_db)):
    """
    The actual "confirm and send" action. This is what fires the SMS.
    Idempotent: if already sent, this becomes a manual resend rather than
    silently sending a duplicate without staff realizing.
    """
    order = _get_order_or_404(order_id, db)
    if order.status not in ("ready_pending_confirm", "ready"):
        raise HTTPException(
            400, f"Order is '{order.status}', nothing to notify about yet"
        )

    success, detail = send_ready_sms(
        to_phone=order.customer.phone,
        customer_name=order.customer.name,
        order_id=order.id,
    )

    order.notification_status = "sent" if success else "failed"
    if success:
        order.status = "ready"
        if order.ready_at is None:
            order.ready_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    if success:
        send_owner_email(f"Order #{order.id} ready for pickup", order)
    return order


@app.patch("/orders/{order_id}/revert-ready", response_model=schemas.OrderOut)
def revert_ready(order_id: int, db: Session = Depends(get_db)):
    """
    Safety valve for an accidental "Confirm & Send": moves the order back
    to in_progress. This does NOT un-send any SMS that already reached the
    customer's phone -- that's not technically possible -- it only fixes
    the internal record so staff can keep working on the order.
    """
    order = _get_order_or_404(order_id, db)
    if order.status != "ready":
        raise HTTPException(400, f"Order is '{order.status}', cannot revert")
    order.status = "in_progress"
    order.ready_at = None
    db.commit()
    db.refresh(order)
    return order


@app.patch("/orders/{order_id}/pickup", response_model=schemas.OrderOut)
def pickup_order(order_id: int, db: Session = Depends(get_db)):
    """ready -> picked_up"""
    order = _get_order_or_404(order_id, db)
    if order.status != "ready":
        raise HTTPException(400, f"Order is '{order.status}', cannot pick up")
    order.status = "picked_up"
    order.picked_up_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


@app.patch("/orders/{order_id}/cancel-ready", response_model=schemas.OrderOut)
def cancel_ready(order_id: int, db: Session = Depends(get_db)):
    """
    Safety valve for the confirm screen: staff clicked "ready" by mistake,
    send them back to in_progress with no SMS sent.
    """
    order = _get_order_or_404(order_id, db)
    if order.status != "ready_pending_confirm":
        raise HTTPException(400, f"Order is '{order.status}', nothing to cancel")
    order.status = "in_progress"
    db.commit()
    db.refresh(order)
    return order


@app.put("/orders/{order_id}/items", response_model=schemas.OrderOut)
def update_order_items(
    order_id: int, items: List[schemas.OrderItemCreate], db: Session = Depends(get_db)
):
    """
    Replaces an order's line items entirely. Only allowed while the order
    hasn't been marked ready yet -- once a customer's been notified, the
    order shouldn't silently change underneath that notification.
    """
    order = _get_order_or_404(order_id, db)
    if order.status not in ("dropped_off", "in_progress"):
        raise HTTPException(
            400, f"Order is '{order.status}', items can no longer be edited"
        )
    if not items:
        raise HTTPException(400, "Order must have at least one line item")

    for existing_item in list(order.items):
        db.delete(existing_item)
    db.flush()

    total = 0.0
    for item in items:
        db.add(models.OrderItem(order_id=order.id, **item.dict()))
        total += item.price_charged * item.quantity
    order.total_price = total

    db.commit()
    db.refresh(order)
    return order


@app.delete("/orders/{order_id}", response_model=schemas.OrderOut)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """
    Cancels an order. This is a SOFT cancel, not a deletion -- the order
    stays in the database permanently with status="cancelled", so it
    doubles as a transaction log (every order that ever existed is still
    queryable later, whether completed or cancelled). Only the "endpoint
    name" (DELETE /orders/{id}) is a delete; the actual data isn't removed.
    """
    order = _get_order_or_404(order_id, db)
    if order.status in ("picked_up", "cancelled"):
        raise HTTPException(400, f"Order is already '{order.status}', cannot cancel")
    order.status = "cancelled"
    order.cancelled_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    send_owner_email(f"Order #{order.id} cancelled", order)
    return order


@app.patch("/orders/{order_id}/uncancel", response_model=schemas.OrderOut)
def uncancel_order(order_id: int, db: Session = Depends(get_db)):
    """
    Restores a cancelled order back to active. Since we don't track what
    stage it was at before cancellation (only that it WAS cancelled),
    this always restores to "dropped_off" -- the safe, simple starting
    point. If it was actually further along, staff can click "Start job"
    again to move it forward.
    """
    order = _get_order_or_404(order_id, db)
    if order.status != "cancelled":
        raise HTTPException(400, f"Order is '{order.status}', not cancelled")
    order.status = "dropped_off"
    order.cancelled_at = None
    db.commit()
    db.refresh(order)
    return order


@app.get("/analytics/summary")
def analytics_summary(weeks: int = 8, db: Session = Depends(get_db)):
    """
    Weekly revenue (grouped by when each order was CREATED, not picked up)
    plus the most-used strings/grips/racket models over the same window.

    Two revenue numbers per week, deliberately kept separate:
    - created_total: value of everything created that week, any status
      (including later-cancelled orders -- shows total business initiated)
    - completed_total: of that same week's orders, how much actually got
      picked up (fulfilled) -- may keep rising for a few weeks after the
      week itself as older orders finally get picked up
    """
    cutoff = datetime.utcnow() - timedelta(weeks=weeks)
    orders = db.query(models.Order).filter(models.Order.created_at >= cutoff).all()

    weekly = defaultdict(lambda: {
        "orders_created": 0, "created_total": 0.0,
        "orders_completed": 0, "completed_total": 0.0,
    })
    for o in orders:
        week_start = (o.created_at - timedelta(days=o.created_at.weekday())).date().isoformat()
        weekly[week_start]["orders_created"] += 1
        weekly[week_start]["created_total"] += o.total_price
        if o.status == "picked_up":
            weekly[week_start]["orders_completed"] += 1
            weekly[week_start]["completed_total"] += o.total_price

    weekly_list = [{"week_start": k, **v} for k, v in sorted(weekly.items())]

    # Exclude cancelled orders' items -- that string/grip wasn't actually used.
    items = (
        db.query(models.OrderItem)
        .join(models.Order)
        .filter(models.Order.created_at >= cutoff, models.Order.status != "cancelled")
        .all()
    )

    string_counts = defaultdict(int)
    grip_counts = defaultdict(int)
    racket_counts = defaultdict(int)
    for item in items:
        if item.product and item.product.category == "string":
            string_counts[item.product.name] += item.quantity
        elif item.product and item.product.category == "grip":
            grip_counts[item.product.name] += item.quantity
        if item.racket_model:
            racket_counts[item.racket_model] += item.quantity

    def top_n(counts, n=5):
        return [{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n]]

    return {
        "weekly": weekly_list,
        "top_strings": top_n(string_counts),
        "top_grips": top_n(grip_counts),
        "top_racket_models": top_n(racket_counts),
    }


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}