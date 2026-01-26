NC DMV Appointment Monitor
Backend / Automation Pet Project (Python, FastAPI)

Live Demo:
https://dmv-appointments-nc.com/

Deployment Notes:
The project is deployed on a Linux VPS and runs as a long-living backend service.
The API server is exposed to the internet via the Caddy web server, which is used as a
reverse proxy and automatically manages HTTPS certificates (Let's Encrypt).

The domain name is manually configured:
- DNS records are pointed to the VPS public IP address
- Caddy routes HTTPS traffic to the FastAPI application
- the monitoring service runs as a separate background process on the same server

OVERVIEW
This project is a production-ready pet project designed to demonstrate backend engineering,
automation, and system design skills using Python and FastAPI.

The application continuously monitors the official North Carolina DMV appointment scheduling
website and delivers instant browser push notifications to users when new appointment slots
become available for selected categories and locations.

The system consists of:
- an asynchronous monitoring service built with Playwright
- a FastAPI backend API
- a SQLite persistence layer
- a Progressive Web App frontend with Push Notifications

This project is intended as a portfolio showcase for Backend Engineer roles.

ARCHITECTURE
The system is split into three logical components:

1) Monitoring Service (Playwright)
2) Backend API (FastAPI)
3) Frontend Client (PWA)

The monitoring service runs independently from the API server and communicates through a shared
SQLite database. This separation allows the crawler to be restarted or scaled independently
from the API layer.

TECH STACK
Backend:
- Python 3
- FastAPI
- Pydantic
- SQLite
- pywebpush
- asyncio

Monitoring:
- Playwright (headless Chromium)
- asyncio
- robust retry and error-handling logic

Frontend:
- HTML / CSS
- Vanilla JavaScript
- Service Worker
- Push API
- PWA Manifest

PROJECT STRUCTURE
api.py
FastAPI application that:
- serves the frontend
- exposes REST API endpoints
- manages subscriptions
- sends push notifications

monitor_service.py
Long-running monitoring service that:
- navigates the NC DMV scheduler UI
- checks categories, locations, calendars, and time slots
- detects new availability
- sends notifications to matching subscribers
- stores availability snapshots

database.py
SQLite data-access layer:
- schema initialization
- subscription CRUD
- availability snapshot storage
- cleanup utilities

index.html
Main PWA user interface.

app.js
Frontend logic:
- Service Worker registration
- push subscription creation
- subscription restore
- availability polling
- UI state management

sw.js
Service Worker:
- static asset caching
- push notification handling
- notification click routing

DATABASE SCHEMA:

subscriptions table:
- user_id (primary key)
- push_subscription (JSON)
- categories (JSON array)
- locations (JSON array)
- date_range_days
- created_at
- updated_at
- last_notification_sent

last_check table:
- category
- location_name
- has_slots
- last_checked

RELIABILITY CONSIDERATIONS
- automatic retries for UI interactions
- spinner and loading-state detection
- browser restarts after multiple cycles
- screenshot capture on critical errors
- isolation between monitor and API layers

SECURITY
- VAPID-based Web Push authentication
- admin endpoints protected by token header
- no passwords or personal data stored

AUTHOR
Mikhail Drogalev
