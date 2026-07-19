import re

def normalize_phone_us(raw: str) -> str:
    """
    Normalizes a phone number into E.164 format, assuming US (+1) when no
    country code is given.
    """
    raw = raw.strip()

    if raw.startswith("+"):
        digits = re.sub(r"[^\d]", "", raw)
        return "+" + digits

    digits = re.sub(r"\D", "", raw)

    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits

    return "+" + digits