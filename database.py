import json
import psycopg2
import psycopg2.extras
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / "shared" / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("database")
logger.setLevel(logging.INFO)

if not logger.handlers:
    file_handler = logging.FileHandler(LOGS_DIR / "database.log", encoding="utf-8")
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

logger.propagate = False


class Database:
    """PostgreSQL database manager for DMV Monitor"""

    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if self.database_url:
            self._init_database()

    def _get_connection(self):
        conn = psycopg2.connect(self.database_url)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn

    def _init_database(self):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    user_id TEXT PRIMARY KEY,
                    push_subscription TEXT NOT NULL,
                    categories TEXT NOT NULL,
                    locations TEXT NOT NULL,
                    date_range_days INTEGER DEFAULT 30,
                    created_at TEXT NOT NULL,
                    last_notification_sent TEXT,
                    updated_at TEXT NOT NULL
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS last_check (
                    id SERIAL PRIMARY KEY,
                    category TEXT NOT NULL,
                    location_name TEXT NOT NULL,
                    has_slots INTEGER DEFAULT 0,
                    last_checked TEXT NOT NULL,
                    UNIQUE(category, location_name)
                )
            """)

            conn.commit()
            logger.info("Database initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
        finally:
            conn.close()

    def get_subscription(self, user_id: str) -> Optional[Dict]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM subscriptions WHERE user_id = %s",
                (user_id,)
            )
            row = cursor.fetchone()

            if not row:
                return None

            return {
                'user_id': row['user_id'],
                'push_subscription': row['push_subscription'],
                'categories': json.loads(row['categories']),
                'locations': json.loads(row['locations']),
                'date_range_days': row['date_range_days'],
                'created_at': row['created_at'],
                'last_notification_sent': row['last_notification_sent']
            }
        finally:
            conn.close()

    def get_all_subscriptions(self) -> List[Dict]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM subscriptions")
            rows = cursor.fetchall()

            return [{
                'user_id': row['user_id'],
                'push_subscription': row['push_subscription'],
                'categories': json.loads(row['categories']),
                'locations': json.loads(row['locations']),
                'date_range_days': row['date_range_days'],
                'created_at': row['created_at'],
                'last_notification_sent': row['last_notification_sent']
            } for row in rows]
        finally:
            conn.close()

    def save_subscription(self, user_id: str, push_subscription: Optional[str],
                          categories: List[str], locations: List[str],
                          date_range_days: int = 30) -> Dict:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT created_at FROM subscriptions WHERE user_id = %s",
                (user_id,)
            )
            existing = cursor.fetchone()

            created_at = existing['created_at'] if existing else datetime.now().isoformat()
            updated_at = datetime.now().isoformat()

            cursor.execute("""
                INSERT INTO subscriptions
                (user_id, push_subscription, categories, locations,
                 date_range_days, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    push_subscription = EXCLUDED.push_subscription,
                    categories = EXCLUDED.categories,
                    locations = EXCLUDED.locations,
                    date_range_days = EXCLUDED.date_range_days,
                    updated_at = EXCLUDED.updated_at
            """, (
                user_id,
                push_subscription,
                json.dumps(categories),
                json.dumps(locations),
                date_range_days,
                created_at,
                updated_at
            ))

            conn.commit()

            return {
                'user_id': user_id,
                'push_subscription': push_subscription,
                'categories': categories,
                'locations': locations,
                'date_range_days': date_range_days,
                'created_at': created_at
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Error saving subscription {user_id}: {e}")
            raise
        finally:
            conn.close()

    def delete_subscription(self, user_id: str) -> bool:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM subscriptions WHERE user_id = %s",
                (user_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting subscription {user_id}: {e}")
            raise
        finally:
            conn.close()

    def remove_old_subscriptions(self, max_age_hours: int) -> int:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cutoff = datetime.now() - timedelta(hours=max_age_hours)
            cursor.execute(
                "DELETE FROM subscriptions WHERE created_at < %s",
                (cutoff.isoformat(),)
            )
            deleted_count = cursor.rowcount
            conn.commit()

            if deleted_count > 0:
                logger.info(f"Removed {deleted_count} outdated subscriptions")

            return deleted_count
        except Exception as e:
            conn.rollback()
            logger.error(f"Error removing old subscriptions: {e}")
            raise
        finally:
            conn.close()

    def get_subscriptions_count(self) -> int:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM subscriptions")
            row = cursor.fetchone()
            return row['count']
        finally:
            conn.close()

    def get_all_last_checks(self) -> List[Dict]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT category, location_name, has_slots, last_checked
                FROM last_check
                ORDER BY location_name, category
            """)
            rows = cursor.fetchall()

            return [{
                'category': row['category'],
                'location_name': row['location_name'],
                'has_slots': row['has_slots'],
                'last_checked': row['last_checked']
            } for row in rows]
        finally:
            conn.close()

    def save_slots_info(self, category: str, locations: List[str],
                        slots_data: List[Dict]) -> None:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            timestamp = datetime.now().isoformat()

            for location in locations:
                cursor.execute("""
                    INSERT INTO last_check (category, location_name, has_slots, last_checked)
                    VALUES (%s, %s, 0, %s)
                    ON CONFLICT (category, location_name) DO UPDATE SET
                        has_slots = 0,
                        last_checked = EXCLUDED.last_checked
                """, (category, location, timestamp))

            for slot in slots_data:
                cursor.execute("""
                    INSERT INTO last_check (category, location_name, has_slots, last_checked)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (category, location_name) DO UPDATE SET
                        has_slots = EXCLUDED.has_slots,
                        last_checked = EXCLUDED.last_checked
                """, (category, slot['location'], slot['slots'], timestamp))

            conn.commit()

        except Exception as e:
            logger.error(f"Error saving slots info: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_locations_with_slots(self) -> List[Dict]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT category, location_name, has_slots, last_checked
                FROM last_check
                WHERE has_slots > 0
            """)
            rows = cursor.fetchall()

            return [{
                'category': row['category'],
                'location_name': row['location_name'],
                'slots_count': row['has_slots'],
                'last_checked': row['last_checked']
            } for row in rows]
        finally:
            conn.close()
