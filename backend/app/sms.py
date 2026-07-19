import os
from .phone_utils import normalize_phone_us

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")


def send_ready_sms(to_phone: str, customer_name: str, order_id: int) -> tuple[bool, str]:
    """
    Sends the "your racket is ready" SMS.
    Returns (success: bool, message: str).

    If Twilio credentials aren't configured, falls back to a mock mode that
    just prints the message -- lets you demo/test the whole flow without a
    real Twilio account yet.
    """
    to_phone = normalize_phone_us(to_phone)

    message_body = (
        f"Hi {customer_name}, your racket (order #{order_id}) is ready for "
        f"pickup! See you soon."
    )

    # TEMPORARY: trial accounts can only send pre-approved template text,
    # not custom messages. This is ONLY for confirming the send pipeline
    # works -- revert to the real message once the account is upgraded.
    # message_body = (
    #     "Your package is out for delivery, arriving by 5 PM today. "
    #     "Test message from Twilio."
    # )

    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        # Mock mode -- no real credentials configured yet.
        print(f"[MOCK SMS] To: {to_phone} | Message: {message_body}")
        return True, "Sent (mock mode -- set TWILIO_* env vars to send real SMS)"

    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message_body, from_=TWILIO_FROM_NUMBER, to=to_phone
        )
        return True, "Sent"
    except Exception as e:
        print(f"[TWILIO ERROR] {str(e)}")
        return False, f"Failed to send: {str(e)}"
