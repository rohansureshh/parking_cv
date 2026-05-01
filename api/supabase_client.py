"""
Supabase setup for the SwiftPark demo API.

The real keys live in .env on the backend machine. Do not expose the service
role key to a frontend app.
"""

import os

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()


def get_supabase() -> Client:
    """Create a Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase settings. Add SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY to .env."
        )

    return create_client(url, key)
