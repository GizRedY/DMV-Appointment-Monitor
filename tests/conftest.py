import pytest
import tempfile
import os
from pathlib import Path
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # Подменяем переменные окружения ДО импорта api
        os.environ.setdefault("VAPID_PRIVATE_KEY", "test_key")
        os.environ.setdefault("VAPID_PUBLIC_KEY", "test_key")
        os.environ.setdefault("VAPID_SUBJECT", "mailto:test@test.com")
        os.environ.setdefault("ADMIN_TOKEN", "test_token")

        # Патчим DATA_DIR до импорта через монкейпатч на уровне модуля
        import api
        api.DATA_DIR = tmp_path
        # Пересоздаём db уже с правильным путём
        api.db = api.Database(tmp_path / "test.db")

        yield TestClient(api.app)
