from werkzeug.security import generate_password_hash


users = [
    {
        "id": "hardik",
        "name": "Hardik Vispute",
        "password_hash": generate_password_hash("hardik123", method="pbkdf2:sha256"),
        "role": "participant"
    },
    {
        "id": "admin",
        "name": "Admin",
        "password_hash": generate_password_hash("admin123", method="pbkdf2:sha256"),
        "role": "admin"
    }
]