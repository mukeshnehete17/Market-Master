import os
from flask import Flask

from flask_cors import CORS

from routes.home import home
from routes.submit_answer import submit_answer
from routes.next_question import next_question, finished
from routes.reset_game import reset_game
from routes.join import join
from routes.profile import profile
from routes.market import market
from routes.result_page import result_page
from routes.rankings import rankings

from routes.login import login
from routes.me import me
from routes.logout import logout
from routes.api_game import api_game


app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "knowledge-exchange-secret-key-2026")
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True


# --------------------------------------------------
# CORS
# --------------------------------------------------

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            ]
        }
    },
    supports_credentials=True
)


# --------------------------------------------------
# Existing Quiz Routes
# --------------------------------------------------

app.add_url_rule(
    "/",
    view_func=home,
    methods=["GET"]
)

app.add_url_rule(
    "/submit",
    view_func=submit_answer,
    methods=["POST"]
)

app.add_url_rule(
    "/next",
    view_func=next_question,
    methods=["GET"]
)

app.add_url_rule(
    "/reset",
    view_func=reset_game,
    methods=["GET"]
)

app.add_url_rule(
    "/finished",
    view_func=finished,
    methods=["GET"]
)

app.add_url_rule(
    "/join",
    view_func=join,
    methods=["GET", "POST"]
)

app.add_url_rule(
    "/profile",
    view_func=profile,
    methods=["GET"]
)

app.add_url_rule(
    "/market",
    view_func=market,
    methods=["GET"]
)

app.add_url_rule(
    "/rankings",
    view_func=rankings,
    methods=["GET"]
)

app.add_url_rule(
    "/result",
    view_func=result_page,
    methods=["GET"]
)


# --------------------------------------------------
# Authentication API
# --------------------------------------------------

app.add_url_rule(
    "/api/auth/login",
    view_func=login,
    methods=["POST"]
)

app.add_url_rule(
    "/api/auth/me",
    view_func=me,
    methods=["GET"]
)

app.add_url_rule(
    "/api/auth/logout",
    view_func=logout,
    methods=["POST"]
)

app.register_blueprint(api_game)


# --------------------------------------------------
# Start Server
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )