"""Timezone derivation from phone number country code."""

COUNTRY_CODE_TO_TIMEZONE = {
    "44": "Europe/London",
    "234": "Africa/Lagos",
    "233": "Africa/Accra",
    "1": "America/New_York",
    "353": "Europe/Dublin",
    "254": "Africa/Nairobi",
    "27": "Africa/Johannesburg",
    "49": "Europe/Berlin",
    "33": "Europe/Paris",
    "971": "Asia/Dubai",
    "91": "Asia/Kolkata",
    "240": "Africa/Malabo",
    "86": "Asia/Shanghai",
    "61": "Australia/Sydney",
    "81": "Asia/Tokyo",
}


def derive_timezone(phone: str) -> str:
    """Derive timezone from phone number country code."""
    phone = phone.lstrip("+")
    for code, tz in sorted(COUNTRY_CODE_TO_TIMEZONE.items(), key=lambda x: -len(x[0])):
        if phone.startswith(code):
            return tz
    return "UTC"
