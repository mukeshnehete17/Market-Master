import os
import jwt

from datetime import datetime, timedelta, timezone


JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "knowledge-exchange-dev-secret-key-32bytes-secure"
)


def create_token(user):
    payload = {
        "sub": user["id"],
        "name": user["name"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=12)
    }

    token = jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256"
    )

    return token