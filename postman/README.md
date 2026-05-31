# Postman — Instagram Automation API

## Import (Postman)

1. Open Postman → **Import**
2. Select both files:
   - `Instagram-Automation.postman_collection.json`
   - `Instagram-Automation.local.postman_environment.json`
3. Top-right environment dropdown → **Instagram Automation - Local**

## Server start

```bash
npm run start:dev
```

Default: `http://localhost:3000/api`

## Test order (recommended)

| Step | Request | Needs |
|------|---------|--------|
| 1 | **Health Check → Server Reachable** | Server running |
| 2 | **Trending → Get All / Get Top** | `GROQ_API_KEY` |
| 3 | **Instagram → Trigger Post** | All `.env` keys (Groq, ImgBB, Meta) |

⚠️ **Trigger Post** runs the full pipeline (image gen + Instagram publish). Use **custom topic** first for controlled tests.

## Variables

| Variable | Default | Use |
|----------|---------|-----|
| `baseUrl` | `http://localhost:3000` | Change if port differs |
| `containerId` | (empty) | For **Check Container Status** after Meta upload |

## cURL (same as Postman)

```bash
curl http://localhost:3000/api/trending/top

curl -X POST http://localhost:3000/api/instagram/post \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"Test topic for automation\"}"
```
