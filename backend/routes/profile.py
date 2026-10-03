"""Route for viewing user profile."""
from flask import render_template

def profile():
    """Display user profile page."""
    return render_template('profile.html')
