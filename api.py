from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header, Depends
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import json
from pathlib import Path
import logging
from pywebpush import webpush, WebPushException
import os
from datetime import datetime
from urllib.parse import urlparse

from database import Database

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")

# ============================================================================
# LOGGING SETUP
# ============================================================================

SHARED_DIR = BASE_DIR / "shared"
DATA_DIR = SHARED_DIR / "data"



VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT")
LOGS_DIR = SHARED_DIR / "logs"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

db = Database(DATA_DIR / "dmv_monitor.db")
LOG_FILE = LOGS_DIR / "api.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("API")


app = FastAPI(title="DMV Monitor API", version="2.0.0") # docs_url=None, openapi_url=None

def require_admin(x_admin_token: str | None = Header(default=None)):
    """
    Admin protection.
    """

    if x_admin_token == os.getenv("ADMIN_TOKEN"):
        return
    raise HTTPException(status_code=401, detail="Unauthorized")



# CORS middleware        # In case if I divide API and Front
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# DMV Categories
DMV_CATEGORIES = {
    "driver_license_first_time": {
        "name": "Driver License - First Time",
        "description": "New driver over 18, new N.C. resident, REAL ID"
    },
    "driver_license_duplicate": {
        "name": "Driver License Duplicate",
        "description": "Replace lost or stolen license, change name or address, REAL ID"
    },
    "driver_license_renewal": {
        "name": "Driver License Renewal",
        "description": "Renew an existing license without any changes, REAL ID"
    },
    "fees": {
        "name": "Fees",
        "description": "License reinstatement appointment, administrative hearings, and medical certifications"
    },
    "id_card": {
        "name": "ID Card",
        "description": "State ID card, REAL ID"
    },
    "knowledge_computer_test": {
        "name": "Knowledge/Computer Test",
        "description": "Written, traffic signs, vision"
    },
    "legal_presence": {
        "name": "Legal Presence",
        "description": "For non-citizens to prove they are legally authorized to be in the U.S."
    },
    "motorcycle_skills_test": {
        "name": "Motorcycle Skills Test",
        "description": "Schedule a motorcycle driving skills test"
    },
    "non_cdl_road_test": {
        "name": "Non-CDL Road Test",
        "description": "Schedule a driving skills test"
    },
    "permits": {
        "name": "Permits",
        "description": "Adult permit, CDL"
    },
    "teen_driver_level_1": {
        "name": "Teen Driver Level 1",
        "description": "Limited learner permit - ages 15-17"
    },
    "teen_driver_level_2": {
        "name": "Teen Driver Level 2",
        "description": "Limited provisional license - ages 16-17; Level 1 permit"
    },
    "teen_driver_level_3": {
        "name": "Teen Driver Level 3",
        "description": "Full provisional license - ages 16-17; Level 2 license"
    }
}


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class PushSubscriptionKeys(BaseModel):
    """Push subscription keys"""
    p256dh: str
    auth: str


class PushSubscriptionInfo(BaseModel):
    """Browser push subscription info"""
    endpoint: str
    keys: PushSubscriptionKeys


class SubscriptionRequest(BaseModel):
    """Request to create/update subscription"""
    user_id: str
    push_subscription: Optional[str] = None
    categories: List[str] = Field(default_factory=list) # Specifically indicated the creation of a separate object
    locations: List[str] = Field(default_factory=list)  #      'Field(default_factory=list)' instead of '[]'
    date_range_days: int = 14


class SubscriptionResponse(BaseModel):
    """Subscription response"""
    user_id: str
    categories: List[str]
    locations: List[str]
    date_range_days: int
    created_at: str


class CategoryInfo(BaseModel):
    """DMV category information"""
    key: str
    name: str
    description: str


class StatusResponse(BaseModel):
    """Service status"""
    status: str
    total_subscriptions: int
    active_categories: List[str]


class VapidKeyResponse(BaseModel):
    """VAPID public key response"""
    public_key: str


class AvailabilityItem(BaseModel):
    """Single availability record for UI"""
    category: str
    location_name: str
    slots_count: int
    last_checked: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def send_push_notification(subscription_info: dict, title: str, body: str,
                           url: str = "/") -> bool:
    """Send push notification to a subscriber"""
    try:
        if not subscription_info or 'push_subscription' not in subscription_info:
            logger.warning("No push subscription found")
            return False

        push_sub = json.loads(subscription_info['push_subscription'])
        endpoint = push_sub.get('endpoint', '')

        # Determine audience based on endpoint
        if 'apple.com' in endpoint:
            aud = 'https://web.push.apple.com'
        elif 'fcm.googleapis.com' in endpoint:
            aud = 'https://fcm.googleapis.com'
        elif 'mozilla.com' in endpoint:
            aud = 'https://updates.push.services.mozilla.com'
        else:
            parsed = urlparse(endpoint)
            aud = f"{parsed.scheme}://{parsed.netloc}"

        vapid_claims = {
            "sub": VAPID_SUBJECT,
            "aud": aud
        }

        notification_data = {
            "title": title,
            "body": body,
            "icon": "/icon-192.png",
            "badge": "/icon-192.png",
            "tag": "dmv-appointment",
            "requireInteraction": True,
            "data": {
                "url": url
            }
        }

        webpush(
            subscription_info=push_sub,
            data=json.dumps(notification_data),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=vapid_claims
        )

        logger.info(f"Push notification sent successfully")
        return True

    except WebPushException as e:
        logger.error(f"WebPush error: {e}")
        if e.response and e.response.status_code in [404, 410]: # 404 / 410 = push endpoint is no longer valid (user disabled notifications, cleared site data, or browser invalidated subscription)
            logger.warning("Subscription no longer valid")
        return False
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return False


# ============================================================================
# STATIC FILE SERVING
# ============================================================================

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Serve main HTML UI"""
    html_file = BASE_DIR / "index.html"
    if html_file.exists():
        return FileResponse(html_file)
    return HTMLResponse("<h1>index.html not found</h1>", status_code=404)


@app.get("/app.js")
async def serve_app_js():
    """Serve app.js"""
    js_file = BASE_DIR / "app.js"
    if js_file.exists():
        return FileResponse(js_file, media_type="application/javascript")
    return HTMLResponse("app.js not found", status_code=404)


@app.get("/sw.js")
async def serve_service_worker():
    """Serve service worker"""
    sw_file = BASE_DIR / "sw.js"
    if sw_file.exists():
        return FileResponse(sw_file, media_type="application/javascript")
    return HTMLResponse("sw.js not found", status_code=404)


@app.get("/manifest.json")
async def serve_manifest():
    """Serve PWA manifest"""
    manifest_file = BASE_DIR / "manifest.json"
    if manifest_file.exists():
        return FileResponse(manifest_file, media_type="application/json")
    return HTMLResponse("manifest.json not found", status_code=404)


@app.get("/icon-192.png")
async def serve_icon_192():
    """Serve 192x192 icon"""
    icon_file = BASE_DIR / "icon-192.png"
    if icon_file.exists():
        return FileResponse(icon_file, media_type="image/png")
    return HTMLResponse("Icon not found", status_code=404)


@app.get("/icon-512.png")
async def serve_icon_512():
    """Serve 512x512 icon"""
    icon_file = BASE_DIR / "icon-512.png"
    if icon_file.exists():
        return FileResponse(icon_file, media_type="image/png")
    return HTMLResponse("Icon not found", status_code=404)


@app.get("/googlebe0bcdc73702fcd4.html")
async def serve_google_verification():
    """Serve Google verification file"""
    verification_file = BASE_DIR / "googlebe0bcdc73702fcd4.html"
    if verification_file.exists():
        return FileResponse(verification_file, media_type="text/html")
    return HTMLResponse("Google verification file not found", status_code=404)


@app.get("/sitemap.xml")
async def serve_sitemap():
    """Serve sitemap.xml"""
    sitemap_file = BASE_DIR / "sitemap.xml"
    if sitemap_file.exists():
        return FileResponse(sitemap_file, media_type="application/xml")
    return HTMLResponse("Sitemap not found", status_code=404)


@app.get("/robots.txt")
async def serve_robots():
    """Serve robots.txt"""
    robots_file = BASE_DIR / "robots.txt"
    if robots_file.exists():
        return FileResponse(robots_file, media_type="text/plain")
    return HTMLResponse("Robots.txt not found", status_code=404)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/vapid-public-key", response_model=VapidKeyResponse)
async def get_vapid_public_key():
    """Get VAPID public key for push notifications"""
    return VapidKeyResponse(public_key=VAPID_PUBLIC_KEY)


@app.get("/categories", response_model=List[CategoryInfo])
async def get_categories():
    """Get list of available DMV categories"""
    result = []

    for key, info in DMV_CATEGORIES.items():
        category = CategoryInfo(
            key=key,
            name=info['name'],
            description=info['description']
        )
        result.append(category)

    return result


@app.get("/availability", response_model=List[AvailabilityItem])
async def get_availability():
    """Get current appointment availability snapshot for UI"""
    try:
        last_check = db.get_all_last_checks()
        items: List[AvailabilityItem] = []

        for item in last_check:
            try:
                items.append(AvailabilityItem(
                    category=item['category'],
                    location_name=item['location_name'],
                    slots_count=item['has_slots'],
                    last_checked=item['last_checked']
                ))
            except Exception:
                continue

        # items.sort(key=lambda x: (x.location_name.lower(), x.category)) #NOTE: ordering is guaranteed by ORDER BY in get_all_last_checks() / (database.py)
        return items
    except Exception as e:
        logger.error(f"Error getting availability: {e}")
        raise HTTPException(status_code=500, detail="Failed to get availability")


@app.post("/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(subscription: SubscriptionRequest):
    """Create or update a subscription"""
    try:
        # Validation
        if not subscription.user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        if not subscription.categories:
            raise HTTPException(status_code=400, detail="At least one category is required")

        if not subscription.push_subscription:
            raise HTTPException(status_code=400, detail="push_subscription is required")

        if not subscription.locations:
            raise HTTPException(status_code=400, detail="At least one location is required")

        # Check if subscription exists
        existing = db.get_subscription(subscription.user_id)

        if existing:
            logger.info(f"Updating existing subscription for user: {subscription.user_id}")
        else:
            logger.info(f"Creating new subscription for user: {subscription.user_id}")

        # Save subscription
        result = db.save_subscription(
            user_id=subscription.user_id,
            push_subscription=subscription.push_subscription,
            categories=subscription.categories,
            locations=subscription.locations,
            date_range_days=subscription.date_range_days
        )

        logger.info(f"Subscription saved successfully for user: {subscription.user_id}")

        return SubscriptionResponse(
            user_id=result['user_id'],
            categories=result['categories'],
            locations=result['locations'],
            date_range_days=result['date_range_days'],
            created_at=result['created_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_subscription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/subscriptions/{user_id}", response_model=SubscriptionResponse)
async def get_subscription(user_id: str):
    """Get a specific subscription"""
    try:
        subscription = db.get_subscription(user_id)

        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")

        return SubscriptionResponse(
            user_id=subscription['user_id'],
            categories=subscription.get('categories', []),
            locations=subscription.get('locations', []),
            date_range_days=subscription.get('date_range_days', 30),
            created_at=subscription.get('created_at', datetime.now().isoformat())
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to get subscription")


@app.delete("/subscriptions/{user_id}")
async def delete_subscription(user_id: str):
    """Delete a subscription"""
    try:
        success = db.delete_subscription(user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Subscription not found")

        logger.info(f"Subscription deleted for user: {user_id}")

        return {"message": "Subscription deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete subscription")


@app.post("/subscriptions/{user_id}/test")
async def test_notification(user_id: str):
    """Send a test notification to user"""
    try:
        subscription = db.get_subscription(user_id)

        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")

        success = send_push_notification(
            subscription_info=subscription,
            title="DMV Monitor Test",
            body="Your notifications are working! You will receive alerts here when DMV appointments become available.",
            url="https://skiptheline.ncdot.gov/Webapp/Appointment/Index/a7ade79b-996d-4971-8766-97feb75254de"
        )

        if success:
            return {"message": "Test notification sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send notification")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending test notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send test notification")


# ============================================================================
# DATABASE MAINTENANCE ENDPOINTS
# ============================================================================

@app.post("/maintenance/cleanup-old-subscriptions", dependencies=[Depends(require_admin)])
async def cleanup_old_subscriptions(max_age_hours: int = 72):
    """Remove subscriptions older than specified hours (admin endpoint)"""
    try:
        removed = db.remove_old_subscriptions(max_age_hours)
        if removed > 0:
            return {
                "message": "Cleanup completed",
                "removed_count": removed
            }
        else:
            return {
                "message": "No old subscriptions to remove"
                    }
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        raise HTTPException(status_code=500, detail="Cleanup failed")


@app.get("/availability/with-slots")
async def get_locations_with_slots():
    """Get all locations that currently have available slots"""
    try:
        locations = db.get_locations_with_slots()
        return locations
    except Exception as e:
        logger.error(f"Error getting locations with slots: {e}")
        raise HTTPException(status_code=500, detail="Failed to get locations")


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    # Check VAPID keys
    if not VAPID_PRIVATE_KEY or VAPID_PRIVATE_KEY == "YOUR_PRIVATE_KEY_HERE":
        logger.warning("=" * 80)
        logger.warning("VAPID KEYS NOT CONFIGURED!")
        logger.warning(
            "Generate keys with: python -c \"from pywebpush import webpush; print(webpush.generate_vapid_keys())\"")
        logger.warning("Then set VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY environment variables")
        logger.warning("=" * 80)

    # Run server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )