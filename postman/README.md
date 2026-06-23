# Postman — Instagram Automation API (v2)

## Import

1. Open Postman → **Import**
2. Select both files:
   - `Instagram-Automation.postman_collection.json`
   - `Instagram-Automation.local.postman_environment.json`
3. Environment dropdown → **Instagram Automation - Local**

## Server start

```bash
npm run start:dev
```

Default base: `http://localhost:3000/api`

## Recommended test order

| Step | Request | Needs |
|------|---------|--------|
| 1 | **Health Check → Server Reachable** | Server running |
| 2 | **Instagram → Token Status** | Meta token in `.env` |
| 3 | **Trends → Fetch Trends** | Supabase + optional YouTube key |
| 4 | **Trends → List Trends** | Supabase (auto-saves `trendId`) |
| 5 | **Instagram → Trigger Post** | Supabase, Groq, Flux, Meta |

⚠️ **Trigger Post** runs the full pipeline (Flux image + Instagram publish). Run **Fetch Trends** first so Supabase has ranked trends.

## API endpoints (v2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trends` | List ranked trends from Supabase |
| GET | `/api/trends/top` | Top unprocessed trend |
| GET | `/api/trends/:id` | Single trend by UUID |
| POST | `/api/trends/fetch` | Fetch Google + Reddit + YouTube → Supabase |
| POST | `/api/instagram/post` | Full publish pipeline |
| GET | `/api/instagram/token-status` | Meta token health |
| POST | `/api/instagram/token-refresh` | Force token refresh |
| GET | `/api/instagram/status/:containerId` | Meta container status |
| POST | `/api/instagram/analytics/fetch` | Fetch insights → Supabase |

## Variables

| Variable | Use |
|----------|-----|
| `baseUrl` | `http://localhost:3000` |
| `trendId` | Auto-set by List/Top trends; used in **Trigger Post (specific trendId)** |
| `containerId` | Meta media container ID from logs |
| `lastInstagramPostId` | Auto-set after successful publish |

## PowerShell (Windows)

```powershell
# List trends
Invoke-RestMethod -Uri "http://localhost:3000/api/trends" -Method GET

# Fetch trends from all sources
Invoke-RestMethod -Uri "http://localhost:3000/api/trends/fetch" -Method POST

# Trigger post (top trend)
Invoke-RestMethod -Uri "http://localhost:3000/api/instagram/post" -Method POST -ContentType "application/json" -Body "{}"

# Token status
Invoke-RestMethod -Uri "http://localhost:3000/api/instagram/token-status" -Method GET
```

## Removed (v1)

- `GET /api/trending` — AI-generated trends (removed)
- `GET /api/trending/top` — replaced by `/api/trends/top`
- Post body `topic` / `niche` — replaced by optional `trendId`
