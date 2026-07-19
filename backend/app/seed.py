"""
Run this once after creating the database to populate starter data:
    python -m app.seed

Focused on the service side of the business (stringing + grip replacement) --
retail sales (rackets, shoes, bags, shuttlecocks) already live on the shop's
Shopify store and aren't tracked in this app.
"""
from .database import SessionLocal, engine, Base
from . import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# --- Services (labor) ---
if not db.query(models.Service).first():
    db.add(models.Service(name="Stringing", price=30.0))
    db.add(models.Service(name="Grip Replacement", price=8.0))
    print("Seeded services.")

# --- Products (strings + grips only -- the physical goods actually used
# during a service, not retail inventory) ---
if not db.query(models.Product).filter(models.Product.category.in_(["string", "grip"])).first():
    products = [
        # Strings -- price_to_customer is $0 since it's bundled into the
        # $30 stringing price, but we still track which specific string
        # (model + color) was used, for inventory/cost/history purposes.
        dict(name="Yonex BG65 (White)", category="string", cost_to_shop=6.0, price_to_customer=0.0),
        dict(name="Yonex BG65 (Black)", category="string", cost_to_shop=6.0, price_to_customer=0.0),
        dict(name="Yonex BG80 (White)", category="string", cost_to_shop=8.0, price_to_customer=0.0),
        dict(name="Yonex BG80 (Yellow)", category="string", cost_to_shop=8.0, price_to_customer=0.0),
        dict(name="Yonex Aerobite (White/Orange)", category="string", cost_to_shop=12.0, price_to_customer=0.0),
        dict(name="Yonex Exbolt 63 (White)", category="string", cost_to_shop=13.0, price_to_customer=0.0),
        dict(name="Yonex Exbolt 65 (Black)", category="string", cost_to_shop=13.0, price_to_customer=0.0),
        dict(name="Babolat RPM Blast (Black)", category="string", cost_to_shop=9.0, price_to_customer=0.0),

        # Grips -- these DO have a real customer price, since grip
        # replacement isn't bundled the way string is.
        dict(name="Tourna Grip (White)", category="grip", cost_to_shop=1.0, price_to_customer=3.0),
        dict(name="Yonex Overgrip (Black)", category="grip", cost_to_shop=1.5, price_to_customer=4.0),
        dict(name="Yonex Overgrip (White)", category="grip", cost_to_shop=1.5, price_to_customer=4.0),
    ]
    for p in products:
        db.add(models.Product(**p))
    print("Seeded products.")

# --- Racket models (reference list for the dropdown, not sold/priced --
# cost/price are unused here, just kept at 0). "Other" is always included
# as a fallback since customers can bring in literally any racket brand. ---
if not db.query(models.Product).filter(models.Product.category == "racket_model").first():
    racket_models = [
        "Yonex Astrox 100ZZ", "Yonex Astrox 99 Pro", "Yonex Astrox 88D Pro",
        "Yonex Astrox 88S Pro", "Yonex Nanoflare 1000Z", "Yonex Nanoflare 800",
        "Yonex Arcsaber 11 Pro", "Yonex Duora 10",
        "Victor Thruster K Falcon", "Victor Auraspeed 90K", "Victor Jetspeed S12",
        "Li-Ning Aeronaut 9000", "Li-Ning Axforce 90",
        "Babolat Satelite Gravity",
    ]
    for name in racket_models:
        db.add(models.Product(name=name, category="racket_model", cost_to_shop=0.0, price_to_customer=0.0))
    print("Seeded racket models.")

db.commit()
db.close()
print("Done.")