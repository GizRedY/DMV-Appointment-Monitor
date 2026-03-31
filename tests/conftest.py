import pytest
import os
from fastapi.testclient import TestClient
from unittest.mock import MagicMock


@pytest.fixture(scope="session")
def client():
    os.environ.setdefault("VAPID_PRIVATE_KEY", "test_key")
    os.environ.setdefault("VAPID_PUBLIC_KEY", "test_key")
    os.environ.setdefault("VAPID_SUBJECT", "mailto:test@test.com")
    os.environ.setdefault("ADMIN_TOKEN", "test_token")

    import api

    mock_db = MagicMock()
    mock_db.get_all_last_checks.return_value = []
    mock_db.get_subscription.return_value = None
    mock_db.get_all_subscriptions.return_value = []
    mock_db.get_subscriptions_count.return_value = 0
    mock_db.get_locations_with_slots.return_value = []

    subscriptions = {}

    def save_sub(user_id, push_subscription, categories, locations, date_range_days=30):
        subscriptions[user_id] = {
            'user_id': user_id,
            'push_subscription': push_subscription,
            'categories': categories,
            'locations': locations,
            'date_range_days': date_range_days,
            'created_at': '2024-01-01T00:00:00'
        }
        return subscriptions[user_id]

    def get_sub(user_id):
        return subscriptions.get(user_id)

    def delete_sub(user_id):
        if user_id in subscriptions:
            del subscriptions[user_id]
            return True
        return False

    mock_db.save_subscription.side_effect = save_sub
    mock_db.get_subscription.side_effect = get_sub
    mock_db.delete_subscription.side_effect = delete_sub

    api.db = mock_db

    yield TestClient(api.app)