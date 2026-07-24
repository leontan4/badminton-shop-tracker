from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="customer")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    active = Column(Boolean, default=True)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # string, grip, shuttlecock, racket, bag, shoe
    cost_to_shop = Column(Float, default=0.0)
    price_to_customer = Column(Float, default=0.0)
    active = Column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    ticket_number = Column(String, nullable=True, index=True)
    # Physical ticket/tag number given to the customer at drop-off, distinct from the internal `id`.
    # Not unique by default -- confirm with the shop whether tickets ever repeat (e.g. reset daily)
    # before adding a uniqueness constraint.
    status = Column(String, default="dropped_off")
    # dropped_off -> in_progress -> ready_pending_confirm -> ready -> picked_up
    notification_status = Column(String, default="not_sent")
    # not_sent -> sent -> failed
    total_price = Column(Float, default=0.0)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ready_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    quantity = Column(Integer, default=1)
    price_charged = Column(Float, nullable=False)  # snapshot at time of order

    order = relationship("Order", back_populates="items")
    service = relationship("Service")
    product = relationship("Product")
    racket_model = Column(String, nullable=True)
    string_tension = Column(String, nullable=True)

    @property
    def service_name(self):
        return self.service.name if self.service else None

    @property
    def product_name(self):
        return self.product.name if self.product else None