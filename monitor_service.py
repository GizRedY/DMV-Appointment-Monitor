import asyncio
import os
import json
import logging
from typing import List, Dict, Set
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from playwright.async_api import Error, async_playwright, Page, Locator
from pywebpush import webpush
from dotenv import load_dotenv

from database import Database

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")

class RestartRequiredException(Exception):
    pass

class ServerErrorException(Exception):
    pass


class Config:

    def __init__(self):
        shared_dir = BASE_DIR / "shared"
        logs_dir = shared_dir / "logs"
        screenshots_dir = logs_dir / "screenshots"
        data_dir = shared_dir / "data"

        logs_dir.mkdir(parents=True, exist_ok=True)
        screenshots_dir.mkdir(parents=True, exist_ok=True)
        data_dir.mkdir(parents=True, exist_ok=True)

        self.db_path = data_dir / "dmv_monitor.db"
        self.log_file = logs_dir / "dmv_monitor.log"
        self.log_level = logging.WARNING

        self.screenshot_switch = True
        self.screenshot_folder = screenshots_dir

        self.calendar_page_text = "Choose a Date"
        self.location_page_text = "Select a Location"
        self.category_page_text = "Please select an appointment type"
        self.main_page_text = "Welcome to the NCDMV Driver Service Appointment Scheduler"
        self.url = (
            "https://skiptheline.ncdot.gov/Webapp/Appointment/Index/"
            "a7ade79b-996d-4971-8766-97feb75254de"
        )


        # VAPID settings
        self.vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
        self.vapid_subject = os.getenv("VAPID_SUBJECT")

        # Subscriptions
        self.max_subscription_age_hours = 72

        # Browser
        self.max_cycles_before_restart = 2

        # Categories and locations
        self.categories = [
            "Driver License - First Time",
            "Driver License Duplicate",
            "Driver License Renewal",
            "Fees",
            "ID Card",
            "Knowledge/Computer Test",
            "Legal Presence",
            "Motorcycle Skills Test",
            "Non-CDL Road Test",
            "Permits",
            "Teen Driver Level 1",
            "Teen Driver Level 2",
            "Teen Driver Level 3",
        ]

        self.category_map = {
            "Driver License - First Time": "driver_license_first_time",
            "Driver License Duplicate": "driver_license_duplicate",
            "Driver License Renewal": "driver_license_renewal",
            "Fees": "fees",
            "ID Card": "id_card",
            "Knowledge/Computer Test": "knowledge_computer_test",
            "Legal Presence": "legal_presence",
            "Motorcycle Skills Test": "motorcycle_skills_test",
            "Non-CDL Road Test": "non_cdl_road_test",
            "Permits": "permits",
            "Teen Driver Level 1": "teen_driver_level_1",
            "Teen Driver Level 2": "teen_driver_level_2",
            "Teen Driver Level 3": "teen_driver_level_3",
        }

        self.locations = [
            "Aberdeen", "Ahoskie", "Albemarle", "Andrews", "Asheboro", "Asheville",
            "Boone", "Brevard", "Bryson City", "Burgaw", "Burnsville", "Carrboro",
            "Cary", "Charlotte East", "Charlotte North", "Charlotte South",
            "Charlotte West", "Clayton", "Clinton", "Clyde", "Concord", "Durham East",
            "Durham South", "Elizabeth City", "Elizabethtown", "Elkin", "Erwin",
            "Fayetteville South", "Fayetteville West", "Forest City", "Franklin",
            "Fuquay-Varina", "Garner", "Gastonia", "Goldsboro", "Graham",
            "Greensboro East", "Greensboro West", "Greenville", "Hamlet", "Havelock",
            "Henderson", "Hendersonville", "Hickory", "High Point", "Hillsborough",
            "Hudson", "Huntersville", "Jacksonville", "Jefferson", "Kernersville",
            "Kinston", "Lexington", "Lincolnton", "Louisburg", "Lumberton", "Marion",
            "Marshall", "Mocksville", "Monroe", "Mooresville", "Morehead City",
            "Morganton", "Mount Airy", "Mount Holly", "Nags Head", "New Bern",
            "Newton", "Oxford", "Polkton", "Raleigh North", "Raleigh West",
            "Roanoke Rapids", "Rocky Mount", "Roxboro", "Salisbury", "Sanford",
            "Shallotte", "Shelby", "Siler City", "Smithfield", "Statesville",
            "Stedman", "Sylva", "Tarboro", "Taylorsville", "Thomasville", "Troy",
            "Washington", "Wendell", "Wentworth", "Whiteville", "Wilkesboro",
            "Williamston", "Wilmington North", "Wilmington South", "Wilson",
            "Winston Salem North", "Winston Salem South", "Yadkinville",
        ]

        self.months_en = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]


class Logger:

    def __init__(self, config: Config):
        self.config = config
        self._setup_logging()
        self.logger = logging.getLogger(__name__)

    def _setup_logging(self):
        logging.basicConfig(
            filename=self.config.log_file,
            level=self.config.log_level,
            format="%(asctime)s [%(levelname)s] %(message)s",
            encoding="utf-8"
        )

    def info(self, message: str):
        self.logger.info(message)

    def warning(self, message: str):
        self.logger.warning(message)

    def error(self, message: str):
        self.logger.error(message)


class ScreenshotManager:

    def __init__(self, config: Config, logger: Logger):
        self.config = config
        self.logger = logger

    async def take_screenshot(self, page: Page):
        if not self.config.screenshot_switch:
            return

        try:
            if page.is_closed():
                self.logger.warning("Cannot take screenshot: page is closed")
                return

            folder = self.config.screenshot_folder
            folder.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filepath = folder / f"screenshot_{timestamp}.png"

            await page.screenshot(path=str(filepath), full_page=False, timeout=5000, animations="disabled")
            self.logger.warning("Screenshot Saved")

        except Exception as e:
            self.logger.warning(f"Failed to take screenshot: {e}")


class SubscriptionManager:

    def __init__(self, config: Config, logger: Logger, db: Database):
        self.config = config
        self.logger = logger
        self.db = db

    def remove_old_subscriptions(self) -> int:
        """Remove subscriptions older than max_subscription_age_hours"""
        try:
            removed = self.db.remove_old_subscriptions(
                self.config.max_subscription_age_hours
            )

            if removed > 0:
                self.logger.info(f"Removed {removed} outdated subscriptions")
                print(f"Removed {removed} expired subscriptions")

            return removed
        except Exception as e:
            self.logger.warning(f"Error removing old subscriptions: {e}")
            return 0

    def load_subscriptions(self) -> List[Dict]:
        """Load all subscriptions from database"""
        try:
            subscriptions = self.db.get_all_subscriptions()
            return subscriptions
        except Exception as e:
            self.logger.warning(f"[load_subscriptions] Error loading subscriptions: {e}")
            return []


class PushNotificationService:

    def __init__(self, config: Config, logger: Logger):
        self.config = config
        self.logger = logger

    def send_push(self, subscription_json: str, title: str, body: str) -> bool:
        try:
            subscription = json.loads(subscription_json)

            endpoint = subscription.get("endpoint", "")
            if not endpoint:
                self.logger.warning("Push error: empty endpoint")
                return False

            if "apple.com" in endpoint:
                aud = "https://web.push.apple.com"
            elif "fcm.googleapis.com" in endpoint:
                aud = "https://fcm.googleapis.com"
            elif "mozilla.com" in endpoint:
                aud = "https://updates.push.services.mozilla.com"
            else:
                parsed = urlparse(endpoint)
                aud = f"{parsed.scheme}://{parsed.netloc}"

            vapid_claims = {
                "sub": self.config.vapid_subject,
                "aud": aud,
            }

            notification_data = {
                "title": title,
                "body": body,
                "icon": "/icon-192.png",
                "badge": "/icon-192.png",
                "tag": "dmv-appointment",
                "requireInteraction": True,
                "data": {
                    "url": self.config.url,
                },
            }

            webpush(
                subscription_info=subscription,
                data=json.dumps(notification_data),
                vapid_private_key=self.config.vapid_private_key,
                vapid_claims=vapid_claims,
            )

            return True

        except Exception as e:
            self.logger.warning(f"Push error: {repr(e)}")
            return False


class NotificationManager:

    def __init__(self, config: Config, logger: Logger, subscription_manager: SubscriptionManager,
                 push_service: PushNotificationService):
        self.config = config
        self.logger = logger
        self.subscription_manager = subscription_manager
        self.push_service = push_service

    async def send_notification(self, category: str, location_name: str,
                                total_slots: Dict[str, List[str]]) -> int:
        if not total_slots:
            return 0

        subscriptions = self.subscription_manager.load_subscriptions()
        if not subscriptions:
            return 0

        mapped_category = self.config.category_map.get(category)

        if not mapped_category:
            self.logger.warning(f"No mapping found for category: {category}")
            return 0

        interested = []
        for item in subscriptions:
            try:
                cats = item.get("categories", [])
                locs = item.get("locations", [])
                push_sub = item.get("push_subscription")
                user_id = item.get("user_id")

                if not push_sub:
                    self.logger.warning(f"Subscriber {user_id} has no push_subscription")
                    continue

                if mapped_category in cats and location_name in locs:
                    interested.append(item)

            except Exception as e:
                self.logger.warning(f"Skipping a corrupted subscription entry: {e}")

        if not interested:
            self.logger.info(f"No subscribers for {category} / {location_name}")
            return 0

        slots_lines = []
        for date_key, times in total_slots.items():
            times_str = ", ".join(times[:2])
            if len(times) > 2:
                times_str += f" (+{len(times) - 2} more)"
            slots_lines.append(f"{date_key}: {times_str}")

        display_lines = slots_lines[:3]
        more_dates_suffix = ""
        if len(slots_lines) > 3:
            more_dates_suffix = f"\n(+{len(slots_lines) - 3} more dates)"

        title = "🚗 New DMV appointment available!"
        body = (
                f"📋 {category}\n"
                f"📍 {location_name}\n"
                f"📅 Available slots:\n" +
                "\n".join(display_lines) +
                more_dates_suffix
        )

        sent_count = 0

        for sub in interested:
            push_subscription_json = sub.get("push_subscription")
            user_id = sub.get("user_id", "unknown")

            try:
                ok = await asyncio.to_thread(
                    self.push_service.send_push,
                    push_subscription_json,
                    title,
                    body,
                )
            except Exception as e:
                self.logger.warning(f"Error sending notification to user {user_id}: {e}")
                ok = False

            if ok:
                sent_count += 1
                self.logger.info(f"Notification successfully sent to user {user_id}")
            else:
                self.logger.warning(f"Failed to send notification to user {user_id}")

        self.logger.info(f"Total successfully sent: {sent_count}")
        return sent_count


class DataStorage:

    def __init__(self, config: Config, logger: Logger, db: Database):
        self.config = config
        self.logger = logger
        self.db = db

    async def save_slots_info(self, category: str, slots_data: List[Dict]):
        """
        Save slots information to database.
        Store category as key (e.g. 'driver_license_first_time'), not label.
        """
        try:
            # Map label -> key (fallback to the original value if already a key)
            category_key = self.config.category_map.get(category, category)

            self.db.save_slots_info(
                category=category_key,
                locations=self.config.locations,
                slots_data=slots_data
            )

            self.logger.info(
                f"Saved {len(slots_data)} locations for category {category} -> {category_key}"
            )

        except Exception as e:
            self.logger.warning(f"Error saving slots info: {repr(e)}")


class PageNavigator:

    def __init__(self, config: Config, logger: Logger, screenshot_manager: ScreenshotManager):
        self.config = config
        self.logger = logger
        self.screenshot_manager = screenshot_manager

    async def wait_for_spinner(self, page: Page, appear_timeout: int = 1000,
                               disappear_timeout: int = 20000):
        loader = page.locator('img[src*="search-loading.gif"]')

        try:
            await loader.wait_for(state="visible", timeout=appear_timeout)
            self.logger.info("Found loader search-loading.gif")

        except PlaywrightTimeoutError:
            self.logger.info("Loader didn't appear search-loading.gif")
            return

        except Exception as e:
            self.logger.warning(f"Error while waited loader: {e}")
            raise

        try:
            await loader.wait_for(state="hidden", timeout=disappear_timeout)
            self.logger.info("Loader disappeared")

        except Exception as e:
            self.logger.info(f"Loader did NOT disappear: {e}")
            raise

    async def safe_click(self, page: Page, target, expected_text=None,
                         timeout=15000, max_attempts=3):

        if isinstance(target, Locator):
            click_locator = target.first
        elif isinstance(target, str) and target.startswith(("#", ".", "[")):
            click_locator = page.locator(target).first
        else:
            click_locator = page.get_by_text(str(target)).first

        expected_locator = None
        if expected_text is not None:
            if isinstance(expected_text, str) and expected_text.startswith(("#", ".", "[")):
                expected_locator = page.locator(expected_text).first
            else:
                expected_locator = page.get_by_text(str(expected_text)).first

        for attempt in range(max_attempts):
            try:
                if expected_locator is not None:
                    try:
                        if await expected_locator.is_visible(timeout=3000):
                            return True
                    except Exception as e:
                        self.logger.info(f"The locator could not be found: {e}")
                        raise

                await click_locator.wait_for(state="visible", timeout=timeout)
                await click_locator.click(timeout=5000)

                if expected_locator is not None:
                    await expected_locator.wait_for(timeout=5000)

                return True

            except Exception as e:
                content = ""
                try:
                    content = await page.content()
                except Exception:
                    pass
                if "Unfortunately, we have encountered an error" in content:
                    self.logger.warning("Detected NCDMV 500 error page")
                    raise ServerErrorException() from e

                if attempt == max_attempts - 1:
                    self.logger.warning(f"All safe_click('{target}') attempts exhausted")
                    await self.screenshot_manager.take_screenshot(page)
                    raise RestartRequiredException() from e

                else:
                    continue

        return False

    async def go_back(self, page: Page, expected_text):
        try:
            if isinstance(expected_text, str) and expected_text.startswith(("#", ".", "[")):
                expected_locator = page.locator(expected_text)
            else:
                expected_locator = page.get_by_text(str(expected_text)).first

            await page.go_back()
            await expected_locator.wait_for(state="visible", timeout=15000)

        except PlaywrightTimeoutError:
            raise RestartRequiredException()

    async def open_main_page(self, page: Page, url: str):
        try:
            await page.goto(url, timeout=60000)
            await page.get_by_text(self.config.main_page_text).first.wait_for(timeout=15000)
        except Exception:
            raise RestartRequiredException()


class SlotChecker:

    def __init__(self, config: Config, logger: Logger, page_navigator: PageNavigator):
        self.config = config
        self.logger = logger
        self.page_navigator = page_navigator

    async def check_slots(self, page: Page, location: str) -> Dict[str, List[str]]:
        await self.page_navigator.wait_for_spinner(page)

        next_button_check = page.locator("a.ui-datepicker-next:not(.ui-state-disabled)")
        next_button_is_available = await next_button_check.count() > 0

        total_time_slots = {}

        slots_current_month = await self._check_month_slots(page, location)
        total_time_slots.update(slots_current_month)

        if next_button_is_available:
            self.logger.info("Switching to next month...")
            await self.page_navigator.safe_click(page, next_button_check)
            await self.page_navigator.wait_for_spinner(page)

            slots_next_month = await self._check_month_slots(page, location)
            total_time_slots.update(slots_next_month)

        total_count = sum(len(times) for times in total_time_slots.values())
        self.logger.info(f"Free slots found in {location}: {total_count}")
        return total_time_slots

    async def _check_month_slots(self, page: Page, location: str) -> Dict[str, List[str]]:
        try:
            month_elem = page.locator(".ui-datepicker-month").first
            year_elem = page.locator(".ui-datepicker-year").first

            month_text = (await month_elem.inner_text()).strip()
            year_text = (await year_elem.inner_text()).strip()

            self.logger.info(f"Processing calendar: {month_text} {year_text}")
        except Exception as e:
            self.logger.warning(f"Failed to extract month/year: {e}")
            from zoneinfo import ZoneInfo
            now = datetime.now(ZoneInfo("America/New_York"))
            month_text = self.config.months_en[now.month - 1]
            year_text = str(now.year)

        calendar = page.locator(
            ".ui-datepicker-inline.ui-datepicker.ui-widget.ui-widget-content"
        )
        active_days = calendar.locator("td[data-handler='selectDay']")
        total_active_days_num = await active_days.count()

        self.logger.info(f"Active days found: {total_active_days_num}")

        month_time_slots = {}

        if total_active_days_num == 0:
            return month_time_slots

        for idx in range(total_active_days_num):
            cell = active_days.nth(idx)
            day = int((await cell.locator("a").inner_text()).strip())

            self.logger.info(f"Clicking on day {day}")
            await self.page_navigator.safe_click(page, cell)
            await self.page_navigator.wait_for_spinner(page)

            time_list = page.locator("select").first
            time_options = time_list.locator("option")
            option_nums = await time_options.count()

            times = []

            for i in range(option_nums):
                option = time_options.nth(i)
                text = (await option.inner_text()).strip()

                if not text or text == "-":
                    continue

                times.append(text)

            if not times:
                continue

            date_key = f"{month_text} {day}, {year_text}"
            month_time_slots[date_key] = times

            self.logger.info(f"Day {day}: found {len(times)} time slots")

        return month_time_slots


class LocationChecker:

    def __init__(self, config: Config, logger: Logger, page_navigator: PageNavigator,
                 slot_checker: SlotChecker, notification_manager: NotificationManager,
                 data_storage: DataStorage, screenshot_manager: ScreenshotManager):
        self.config = config
        self.logger = logger
        self.page_navigator = page_navigator
        self.slot_checker = slot_checker
        self.notification_manager = notification_manager
        self.data_storage = data_storage
        self.screenshot_manager = screenshot_manager

    async def check_locations(self, page: Page, category: str):
        visited_locations: Set[str] = set()
        slots_data = []

        for location in self.config.locations:
            if location in visited_locations:
                continue

            loc = page.locator(".QflowObjectItem.Active-Unit", has_text=location).first

            if await loc.count() == 0:
                continue

            visited_locations.add(location)

            self.logger.info(f"Entering location: {location}")

            try:
                try:
                    await self.page_navigator.safe_click(page, loc, self.config.calendar_page_text)
                    total_slots = await self.slot_checker.check_slots(page, location)

                except ServerErrorException:
                    total_slots = {}

                except Exception as e:
                    self.logger.warning(f"Error checking slots at {location}: {e}")
                    await self.screenshot_manager.take_screenshot(page)
                    total_slots = {}

                total_slots_nums = sum(len(times) for times in total_slots.values())

                await self.notification_manager.send_notification(category, location, total_slots)

                slots_data.append({"location": location, "slots": total_slots_nums})

            finally:
                await self.page_navigator.go_back(page, self.config.location_page_text)

            self.logger.info(f"Exited calendar: {location}")

        if not slots_data:
            self.logger.info(f"No active locations in {category}")

        await self.data_storage.save_slots_info(category, slots_data)


class CategoryChecker:

    def __init__(self, config: Config, logger: Logger, page_navigator: PageNavigator,
                 location_checker: LocationChecker, screenshot_manager: ScreenshotManager):
        self.config = config
        self.logger = logger
        self.page_navigator = page_navigator
        self.location_checker = location_checker
        self.screenshot_manager = screenshot_manager

    async def check_category(self, page: Page):
        await self.page_navigator.open_main_page(page, self.config.url)

        await self.page_navigator.safe_click(page, '#cmdMakeAppt', self.config.category_page_text)
        self.logger.info("Opened category selection")

        for category in self.config.categories:
            self.logger.info(f"Processing category: {category}")

            try:
                await self.page_navigator.safe_click(page, category, self.config.location_page_text)
                self.logger.info(f"Entered category: {category}")

                await self.location_checker.check_locations(page, category)

                await self.page_navigator.go_back(page, self.config.category_page_text)

            except Exception as e:
                self.logger.warning(f"Error processing category {category}: {e}")
                await self.screenshot_manager.take_screenshot(page)

                try:
                    await self.page_navigator.open_main_page(page, self.config.url)
                    await self.page_navigator.safe_click(page, '#cmdMakeAppt',
                                                         self.config.category_page_text)
                    self.logger.info("Re-entered category selection")
                except RestartRequiredException:
                    self.logger.warning("Failed to re-enter category selection")
                    raise


class DMVMonitor:

    def __init__(self):
        self.config = Config()
        self.logger = Logger(self.config)
        self.db = Database(self.config.db_path)
        self.screenshot_manager = ScreenshotManager(self.config, self.logger)
        self.subscription_manager = SubscriptionManager(self.config, self.logger, self.db)
        self.push_service = PushNotificationService(self.config, self.logger)
        self.notification_manager = NotificationManager(
            self.config, self.logger, self.subscription_manager, self.push_service
        )
        self.data_storage = DataStorage(self.config, self.logger, self.db)
        self.page_navigator = PageNavigator(self.config, self.logger, self.screenshot_manager)
        self.slot_checker = SlotChecker(self.config, self.logger, self.page_navigator)
        self.location_checker = LocationChecker(
            self.config, self.logger, self.page_navigator, self.slot_checker,
            self.notification_manager, self.data_storage, self.screenshot_manager
        )
        self.category_checker = CategoryChecker(
            self.config, self.logger, self.page_navigator, self.location_checker,
            self.screenshot_manager
        )

    async def run(self):
        while True:
            async with async_playwright() as p:
                browser = None
                try:
                    browser = await p.chromium.launch(headless=True)
                    self.logger.info("Browser started")

                    cycles_count = 0
                    max_cycles = self.config.max_cycles_before_restart

                    while cycles_count < max_cycles:
                        context = None
                        try:
                            context = await browser.new_context(
                                geolocation={"longitude": -78.65, "latitude": 35.78},
                                permissions=["geolocation"],
                            )

                            page = await context.new_page()

                            self.subscription_manager.remove_old_subscriptions()
                            cycles_count += 1
                            self.logger.info(f"Cycle {cycles_count} of {max_cycles}")

                            await self.category_checker.check_category(page)

                        except Exception as e:
                            self.logger.warning(f"ServerError: {e}")
                            self.logger.info("Restarting browser...")

                            if context:
                                try:
                                    await context.close()
                                except Exception:
                                    pass
                            break

                        finally:
                            if context:
                                try:
                                    await context.close()
                                except Exception:
                                    pass

                            await asyncio.sleep(2)

                    self.logger.info("Restarting browser...")

                except Exception as e:
                    self.logger.error(f"Critical browser error: {e}")

                finally:
                    if browser:
                        try:
                            await browser.close()
                        except Exception:
                            pass

                    await asyncio.sleep(5)


if __name__ == "__main__":
    monitor = DMVMonitor()
    asyncio.run(monitor.run())