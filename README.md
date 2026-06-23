# Instagram Automation API (Groq + Pollinations Edition)

Production-ready NestJS backend that automates Instagram posting using **real trending topics** from free RSS feeds — no paid trend APIs, no AI-invented topics.

## Architecture Rules (CRITICAL)

1. **No fake trends** — Trends always come from Google Trends RSS + Google News RSS. AI never discovers or invents topics.
2. **Groq is text-only** — Groq generates caption, hashtags, and image prompt. It has **no** image generation capability.
3. **Pollinations for images** — Free, keyless Flux-based image generation returns a **public URL directly** — no ImgBB or separate hosting step.

```
Google Trends RSS ──┐
                    ├──► SQLite ──► Score ──► Top Trend ──► Groq (caption, hashtags, prompt)
Google News RSS  ───┘                                              │
                                                                     ▼
                                              Pollinations (public image URL) → Meta Graph API → Instagram
```

## Tech Stack

- **NestJS 10** + TypeScript
- **SQLite** via TypeORM + sql.js
- **Google Trends RSS** + **Google News RSS** (free, no API keys)
- **Groq** (`openai/gpt-oss-120b`) — text content only
- **Pollinations.ai** — free image generation (Flux), no key required
- **Meta Graph API v21** — Instagram publishing

## Setup

```bash
cd instagram-automation
npm install
cp .env.example .env
# Fill in GROQ_API_KEY, INSTAGRAM_*, META_*
npm run start:dev
```

API: `http://localhost:3000/api`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | [Groq Console](https://console.groq.com/keys) |
| `GROQ_MODEL` | No | Default `openai/gpt-oss-120b` |
| `INSTAGRAM_ACCESS_TOKEN` | Yes | Meta long-lived token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Yes | IG Business account ID |
| `META_APP_ID` / `META_APP_SECRET` | Yes | Meta Developer app |
| `POLLINATIONS_*` | No | Defaults work — no key needed |
| `TRENDS_GEO` | No | Default `IN` |
| `CRON_TREND_FETCH` | No | Default every 3 hours |
| `CRON_POST_GENERATION` | No | Default 9 AM & 6 PM |
| `DB_PATH` | No | Default `./data/instagram-automation.sqlite` |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trends` | List ranked trends |
| GET | `/api/trends/top` | Top unprocessed trend |
| GET | `/api/trends/:id` | Single trend |
| POST | `/api/trends/fetch` | Manual trend fetch |
| POST | `/api/instagram/post` | Full publish pipeline |
| GET | `/api/posts` | List generated posts |
| GET | `/api/posts/:id` | Single post |
| GET | `/api/instagram/status/:containerId` | Meta container status |

### curl Examples

```bash
# Fetch real trends from Google RSS
curl.exe -X POST http://localhost:3000/api/trends/fetch

# List ranked trends
curl.exe http://localhost:3000/api/trends

# Publish top unprocessed trend
curl.exe -X POST http://localhost:3000/api/instagram/post -H "Content-Type: application/json" -d "{}"

# Publish a specific trend
curl.exe -X POST http://localhost:3000/api/instagram/post -H "Content-Type: application/json" -d "{\"trendId\":\"uuid-here\"}"
```

## Scoring Formula

```
trafficScore = min(100, log10(traffic + 1) × 14)     → 60% weight
newsScore    = min(100, articles×8 + recency×12)     → 40% weight
finalScore   = trafficScore × 0.6 + newsScore × 0.4
```

## Cron Jobs

| Job | Default | Action |
|-----|---------|--------|
| Trend fetch | `0 */3 * * *` | Crawl RSS → SQLite → score |
| Post generation | `0 9,18 * * *` | Top trend → Groq → Pollinations → publish |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Groq model deprecation error | Check [console.groq.com/docs/models](https://console.groq.com/docs/models), update `GROQ_MODEL` |
| `stored: 0` on trend fetch | Try `TRENDS_GEO=US`; Google RSS may block some regions |
| Pollinations 401 on image gen | Change `POLLINATIONS_BASE_URL` to `https://image.pollinations.ai/prompt`, or add key from [enter.pollinations.ai](https://enter.pollinations.ai) |
| Meta error 190 | Token auto-refresh runs on startup and on publish failure. If `.env` token is also expired, generate a new one at [developers.facebook.com](https://developers.facebook.com) and restart |
| Groq JSON parse fail | Auto-retries once with stricter prompt |

## License

MIT
