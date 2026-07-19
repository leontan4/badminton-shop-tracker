import os
import smtplib
from email.mime.text import MIMEText

OWNER_EMAIL = os.environ.get("OWNER_EMAIL")
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))


def _format_order_summary(order) -> str:
    """Builds the itemized order details shared across all email types."""
    lines = [f"Order #{order.id}", f"Customer: {order.customer.name} ({order.customer.phone})", ""]
    lines.append("Items:")
    for item in order.items:
        name = item.service_name or item.product_name or "item"
        lines.append(f"  - {item.quantity}x {name} (${item.price_charged:.2f})")
    lines.append("")
    lines.append(f"Total: ${order.total_price:.2f}")
    return "\n".join(lines)


def send_owner_email(subject: str, order) -> tuple[bool, str]:
    """
    Sends a notification email to the owner about an order event.
    Returns (success, detail). Falls back to mock/console mode if SMTP
    credentials aren't configured -- same pattern as sms.py.
    """
    body = _format_order_summary(order)

    if not (OWNER_EMAIL and SMTP_USER and SMTP_PASSWORD):
        print(f"[MOCK EMAIL] To: {OWNER_EMAIL} | Subject: {subject}\n{body}")
        return True, "Sent (mock mode -- set OWNER_EMAIL/SMTP_* env vars to send real email)"

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = OWNER_EMAIL

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [OWNER_EMAIL], msg.as_string())
        return True, "Sent"
    except Exception as e:
        print(f"[EMAIL ERROR] {str(e)}")
        return False, f"Failed to send: {str(e)}"