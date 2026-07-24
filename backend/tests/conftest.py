import os

# Must be set before app.main is imported anywhere in the test suite --
# the auth middleware checks this to skip login enforcement entirely,
# since tests hit the API directly via TestClient and never log in.
os.environ["TESTING"] = "1"

# Force mock mode for email/SMS regardless of what's in .env -- tests should
# never make real network calls to SMTP or Twilio, even if real credentials
# are present locally (e.g. from A2P testing). A real network call hanging
# makes the whole suite look frozen/stuck in an infinite loop.
#
# NOTE: must set to "" rather than delete/pop -- app.main calls load_dotenv()
# on import, which by default only fills in variables that AREN'T already
# present in os.environ. If we deleted these instead, load_dotenv() would
# just repopulate them from .env the moment app.main is imported, undoing
# this entirely.
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ["OWNER_EMAIL"] = ""
os.environ["TWILIO_ACCOUNT_SID"] = ""
os.environ["TWILIO_AUTH_TOKEN"] = ""
os.environ["TWILIO_FROM_NUMBER"] = ""