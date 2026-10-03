from werkzeug.security import check_password_hash

from database.get_user import get_user_by_id


def authenticate_user(user_id, password):
    user = get_user_by_id(user_id)

    if not user:
        return None

    if not check_password_hash(user["password_hash"], password):
        return None

    return {
        "id": user["id"],
        "name": user["name"],
        "role": user["role"]
    }