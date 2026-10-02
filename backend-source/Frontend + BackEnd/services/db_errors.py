"""Database error types (mobile-optimization pass, backend safety).

When Supabase credentials are configured, persistence failures must be
loud: raise DatabaseUnavailable so the API returns a controlled 503
instead of silently serving in-memory fallback data as if it were real.
"""


class DatabaseUnavailable(Exception):
    """Raised when a real Supabase operation fails while configured."""
