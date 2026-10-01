import os
import jwt


JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "knowledge-exchange-dev-secret-key-32bytes-secure"
)


def verify_token(token):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"]
        )

        return payload

    except jwt.ExpiredSignatureError:
        return None

    except jwt.InvalidTokenError:
        return None