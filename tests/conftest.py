import pytest
import tempfile
import os
from pathlib import Path
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        os.environ.setdefault("VAPID_PRIVATE_KEY", "test_key")
        os.environ.setdefault("VAPID_PUBLIC_KEY", "test_key")
        os.environ.setdefault("VAPID_SUBJECT", "mailto:test@test.com")
        os.environ.setdefault("ADMIN_TOKEN", "test_token")

        # Для тестов используем SQLite через psycopg2-совместимый интерфейс
        # Проще — мокируем Database целиком
        import api
        from unittest.mock import MagicMock, patch

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