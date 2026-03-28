def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_categories(client):
    response = client.get("/categories")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 13  # У тебя ровно 13 категорий в DMV_CATEGORIES

    # Проверяем структуру одного элемента
    first = data[0]
    assert "key" in first
    assert "name" in first
    assert "description" in first


def test_get_availability_empty(client):
    # В тестовой БД слотов нет — должен вернуть пустой список
    response = client.get("/availability")
    assert response.status_code == 200
    assert response.json() == []


def test_subscription_not_found(client):
    response = client.get("/subscriptions/nonexistent-user-123")
    assert response.status_code == 404


def test_create_subscription_missing_fields(client):
    # Пустой запрос — должен вернуть 422 (валидация Pydantic)
    response = client.post("/subscriptions", json={})
    assert response.status_code == 422


def test_create_and_get_subscription(client):
    payload = {
        "user_id": "test-user-abc",
        "push_subscription": '{"endpoint":"https://fcm.googleapis.com/test","keys":{"p256dh":"test","auth":"test"}}',
        "categories": ["driver_license_renewal"],
        "locations": ["Durham East"],
        "date_range_days": 14
    }
    # Создаём
    response = client.post("/subscriptions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test-user-abc"
    assert data["categories"] == ["driver_license_renewal"]

    # Получаем
    response = client.get("/subscriptions/test-user-abc")
    assert response.status_code == 200
    assert response.json()["user_id"] == "test-user-abc"


def test_delete_subscription(client):
    # Сначала создаём
    payload = {
        "user_id": "user-to-delete",
        "push_subscription": '{"endpoint":"https://fcm.googleapis.com/test","keys":{"p256dh":"test","auth":"test"}}',
        "categories": ["id_card"],
        "locations": ["Cary"],
        "date_range_days": 7
    }
    client.post("/subscriptions", json=payload)

    # Удаляем
    response = client.delete("/subscriptions/user-to-delete")
    assert response.status_code == 200

    # Проверяем что удалилось
    response = client.get("/subscriptions/user-to-delete")
    assert response.status_code == 404


def test_delete_nonexistent_subscription(client):
    response = client.delete("/subscriptions/nobody-here")
    assert response.status_code == 404
