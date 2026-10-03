from werkzeug.security import generate_password_hash


users = [
    {
        "id": "admin",
        "name": "Admin",
        "password_hash": generate_password_hash("ECELLADMIN", method="pbkdf2:sha256"),
        "role": "admin"
    }
]