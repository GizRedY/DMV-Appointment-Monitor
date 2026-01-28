import sqlite3
import json
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
    """SQLite database manager for DMV Monitor"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()

    def _get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        """Initialize database tables"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            # Subscriptions table
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

            # Last check table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS last_check (
                    id INTEGER PRIMARY KEY,
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
        """Get subscription by user_id"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM subscriptions WHERE user_id = :user_id", # После двоеточия мы указываем имя ключа у которого будет необходимое значение
                {"user_id": user_id} # Имя ключа по факту может быть любым.
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
        """Get all subscriptions"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM subscriptions")
            rows = cursor.fetchall()

            subscriptions = []
            for row in rows:
                subscriptions.append({
                    'user_id': row['user_id'],
                    'push_subscription': row['push_subscription'],
                    'categories': json.loads(row['categories']),
                    'locations': json.loads(row['locations']),
                    'date_range_days': row['date_range_days'],
                    'created_at': row['created_at'],
                    'last_notification_sent': row['last_notification_sent']
                })

            return subscriptions
        finally:
            conn.close()

    def save_subscription(self, user_id: str, push_subscription: Optional[str],
                          categories: List[str], locations: List[str],
                          date_range_days: int = 30) -> Dict:
        """Create or update subscription"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT created_at FROM subscriptions WHERE user_id = :user_id",
                {"user_id": user_id}
            )
            subscription_row = cursor.fetchone()

            created_at = (
                subscription_row['created_at']
                if subscription_row
                else datetime.now().isoformat()
            )
            updated_at = datetime.now().isoformat()

            cursor.execute("""
                INSERT OR REPLACE INTO subscriptions 
                (user_id, push_subscription, categories, locations, date_range_days, 
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
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
                "DELETE FROM subscriptions WHERE user_id = :user_id",
                {'user_id': user_id}
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
            cutoff_str = cutoff.isoformat()

            cursor.execute(
                "DELETE FROM subscriptions WHERE created_at < :cutoff_str",
                {'cutoff_str': cutoff_str}
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
        """Get total number of subscriptions"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM subscriptions")
            row = cursor.fetchone()
            return row['count']
        finally:
            conn.close()

    # ============================================================================
    # LAST CHECK METHODS
    # ============================================================================

    def get_all_last_checks(self) -> List[Dict]:
        """Get all last check records"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT category, location_name, has_slots, last_checked 
                FROM last_check
                ORDER BY location_name, category
            """)

            rows = cursor.fetchall()

            results = []
            for row in rows:
                results.append({
                    'category': row['category'],
                    'location_name': row['location_name'],
                    'has_slots': row['has_slots'],
                    'last_checked': row['last_checked']
                })

            return results
        finally:
            conn.close()

    def save_slots_info(self, category: str, locations: List[str],
                        slots_data: List[Dict]) -> None:
        """Save slots information for a category"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            timestamp = datetime.now().isoformat()

            # Update all locations for this category to 0 slots first
            for location in locations:
                cursor.execute("""
                    INSERT INTO last_check (category, location_name, has_slots, last_checked)
                    VALUES (?, ?, 0, ?)
                    ON CONFLICT(category, location_name) 
                    DO UPDATE SET 
                        has_slots = 0,
                        last_checked = excluded.last_checked 
                """, (category, location, timestamp)) #excluded - это строка в памяти SQL которую пытались вставить. Существует только в Conflict

            # Update locations that have slots
            for slot in slots_data:
                location_name = slot['location']
                slots_count = slot['slots']

                cursor.execute("""
                    INSERT INTO last_check (category, location_name, has_slots, last_checked)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(category, location_name) 
                    DO UPDATE SET 
                        has_slots = excluded.has_slots,
                        last_checked = excluded.last_checked
                """, (category, location_name, slots_count, timestamp))

            conn.commit()
            # logger.info(f"Saved slots info for {len(slots_data)} locations in category {category}")

        except Exception as e:
            logger.error(f"Error saving slots info: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_locations_with_slots(self) -> List[Dict]:
        """Get all locations that currently have available slots"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT category, location_name, has_slots, last_checked 
                FROM last_check
                WHERE has_slots > 0
            """)

            rows = cursor.fetchall()

            results = []
            for row in rows:
                results.append({
                    'category': row['category'],
                    'location_name': row['location_name'],
                    'slots_count': row['has_slots'],
                    'last_checked': row['last_checked']
                })

            return results
        finally:
            conn.close()