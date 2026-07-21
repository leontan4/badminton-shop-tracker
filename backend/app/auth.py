import os
import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

# One shared login for the whole shop -- matches the current Basic Auth
# setup (single username/password everyone uses), just moved from Caddy
# into the app itself so we can show a real login page instead of the
# browser's native popup.
#
# SHOP_PASSWORD_HASH can reuse the exact same bcrypt hash you already
# generated for Caddy's basicauth (both are standard bcrypt), so there's
# no need to create a new password from scratch.
SHOP_USERNAME = os.environ.get("SHOP_USERNAME", "staff")
SHOP_PASSWORD_HASH = os.environ.get("SHOP_PASSWORD_HASH", "")

# A separate secret used only to sign session cookies -- NOT the login
# password. Generate a random one with: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = os.environ.get("SECRET_KEY", "")

SESSION_COOKIE_NAME = "session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 days -- this is a shared shop device, not a personal login

_serializer = URLSafeTimedSerializer(SECRET_KEY or "dev-only-insecure-key-change-me")


def verify_credentials(username: str, password: str) -> bool:
    if not SHOP_PASSWORD_HASH:
        return False
    if username != SHOP_USERNAME:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), SHOP_PASSWORD_HASH.encode("utf-8"))
    except ValueError:
        return False  # malformed hash


def create_session_token() -> str:
    return _serializer.dumps({"user": SHOP_USERNAME})


def verify_session_token(token: str) -> bool:
    if not token:
        return False
    try:
        _serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
        return True
    except (BadSignature, SignatureExpired):
        return False