# Postman Collection — Instagram Automation API (v2.0)

A production-grade, end-to-end Postman collection and environment for testing the **Instagram Automation System** in real-time.

---

## 🚀 Quick Start (Import to Postman)

1. Open **Postman** (Desktop or Web).
2. Click **Import** (top left).
3. Select both files inside this directory:
   - [`Instagram-Automation.postman_collection.json`](./Instagram-Automation.postman_collection.json)
   - [`Instagram-Automation.local.postman_environment.json`](./Instagram-Automation.local.postman_environment.json)
4. In Postman's top-right corner, select the environment **`Instagram Automation - Local`**.

---

## ⚙️ Start Your Backend Server

Make sure your NestJS server is running:

```bash
npm run start:dev
```

> **Base URL:** The default base URL is `http://localhost:3000/api` (or whichever `PORT` is configured in your `.env`).

---

## 🔐 Automated Auth & Variable Chaining

All protected endpoints require a JWT Bearer token (`Authorization: Bearer {{authToken}}`).

1. **Run `1. Authentication -> 1. Admin Login` first.**
2. The Post-response Test script **automatically captures** `data.accessToken` and stores it into `authToken` in your Postman environment.
3. All requests across the collection inherit this token seamlessly.

### Automated Variable Chaining:
| Step / Request | Automatically Extracted Variable | Used By |
|---|---|---|
| `POST /api/auth/login` | `authToken` | Collection-level Bearer authorization header |
| `GET /api/trends` or `GET /api/trends/top` | `trendId` | `GET /api/trends/:id`, `POST /api/instagram/post` |
| `POST /api/instagram/post` or `GET /api/posts` | `postId`, `lastInstagramPostId` | `GET /api/posts/:id`, `GET /api/analytics/:mediaId` |
| `GET /api/analytics` | `mediaId` | `GET /api/analytics/:mediaId` |

---

## 📋 Recommended Real-Time Test Flow

| Step | Folder / Request | Method & Route | What It Does |
|---|---|---|---|
| **1** | **Auth** → `1. Admin Login` | `POST /api/auth/login` | Authenticates with `adminEmail` / `adminPassword` and saves `authToken`. |
| **2** | **Auth** → `2. Get Profile` | `GET /api/auth/me` | Validates active session and operator role. |
| **3** | **Dashboard** → `1. Get Dashboard Overview` | `GET /api/dashboard/overview` | Inspects system-wide stats, post counts, and active trends. |
| **4** | **Instagram** → `1. Get Meta Token Status` | `GET /api/instagram/token-status` | Verifies Meta Graph API long-lived token validity and expiry. |
| **5** | **Trends** → `1. Fetch Trends` | `POST /api/trends/fetch` | Scrapes Google Trends and Google News RSS in real-time. |
| **6** | **Trends** → `2. List Ranked Trends` | `GET /api/trends?page=1&limit=15` | Views ranked trends (auto-captures top `trendId`). |
| **7** | **Trends** → `3. Top Unprocessed Trend` | `GET /api/trends/top` | Inspects the next trend queued for post generation. |
| **8** | **Posts** → `1. Trigger Post Pipeline` | `POST /api/instagram/post` | Runs full AI copywriting (Groq), canvas card composing, and Meta Graph API Instagram publishing. |
| **9** | **Posts** → `3. List Posts` | `GET /api/posts` | Inspects generated posts, published URLs, and status. |
| **10** | **Analytics** → `1. Fetch Analytics` | `POST /api/analytics/fetch` | Syncs live likes, comments, impressions, and reach from Instagram. |
| **11** | **Settings** → `1. Get Settings` / `2. Update` | `GET /api/settings`, `PUT /api/settings` | Views or updates API keys, active niche, cron schedules, or timezone. |

---

## 🗂️ Complete Endpoint Directory (20 Endpoints)

### 1. Authentication
- `POST /api/auth/login` — Single-operator admin login (Public)
- `GET /api/auth/me` — Validate session and role

### 2. Dashboard
- `GET /api/dashboard/overview` — Real-time summary statistics

### 3. Trends
- `POST /api/trends/fetch` — Fetch & score trends from Google Trends and Google News RSS
- `GET /api/trends?page=1&limit=15` — List ranked trends
- `GET /api/trends/top` — Get single top unprocessed trend
- `GET /api/trends/:id` — Get single trend by UUID

### 4. Posts & Publishing
- `POST /api/instagram/post` — Trigger full pipeline for top trend (body: `{}`) or specific trend (body: `{"trendId": "..."}`)
- `GET /api/posts?page=1&limit=20` — List post history
- `GET /api/posts/:id` — Get post details by UUID

### 5. Instagram & Meta API
- `GET /api/instagram/token-status` — Check Meta Graph API access token health
- `POST /api/instagram/token-bootstrap` — Exchange short-lived token to 60-day long-lived token
- `POST /api/instagram/token-refresh` — Force token refresh
- `GET /api/instagram/status/:containerId` — Query Meta media container status

### 6. Analytics & Insights
- `POST /api/analytics/fetch` — Sync post insights from Meta Graph API
- `GET /api/analytics?limit=50` — List engagement metrics
- `GET /api/analytics/:mediaId` — Get metrics for specific Instagram media ID

### 7. Settings & Configuration
- `GET /api/settings` — Get dynamic settings (API keys masked)
- `PUT /api/settings` — Update settings and auto-reschedule cron jobs
- `GET /api/settings/niches` — List supported topic niches

---

## 💻 PowerShell Real-Time Testing Examples

If you prefer testing directly from your PowerShell terminal:

```powershell
# 1. Login & get JWT token
$loginResp = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@automation.local","password":"Admin@12345"}'
$token = $loginResp.data.accessToken
$headers = @{ "Authorization" = "Bearer $token" }

# 2. Get dashboard overview
Invoke-RestMethod -Uri "http://localhost:3000/api/dashboard/overview" -Method GET -Headers $headers

# 3. Trigger trend fetch
Invoke-RestMethod -Uri "http://localhost:3000/api/trends/fetch" -Method POST -Headers $headers

# 4. List trends
$trends = Invoke-RestMethod -Uri "http://localhost:3000/api/trends?page=1&limit=5" -Method GET -Headers $headers
$trends.data.trends
```
