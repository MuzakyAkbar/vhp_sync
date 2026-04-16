# VHP Sync Service — Artotel Cabin Bromo

Express service that pulls data from the VHP PMS API and upserts it into Supabase. Includes a built-in monitoring dashboard.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

**Required `.env` values:**
| Key | Description |
|-----|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (not anon key) |
| `VHP_BASE_URL` | VHP server base URL |
| `VHP_USERNAME` | VHP API username |
| `VHP_USERINIT` | VHP user init (short code) |
| `VHP_USERKEY` | VHP user key (hex string) |

**Optional:**
| Key | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `SYNC_CRON` | `0 1 * * *` | Cron schedule (daily at 01:00) |
| `SYNC_LOOKBACK_DAYS` | `1` | Days back for date-range reports |
| `API_SECRET` | *(none)* | Bearer token for protected endpoints |

### 3. Create Supabase tables
Run `schema.sql` in your Supabase SQL editor (Dashboard → SQL Editor → New query).

### 4. Start the service
```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Monitoring dashboard |
| GET | `/health` | — | Health check |
| GET | `/api/status` | — | Table row counts + last sync |
| GET | `/api/logs` | Bearer | Last 50 sync log entries |
| POST | `/api/sync` | Bearer | Sync **all** reports |
| POST | `/api/sync/arrival-date` | Bearer | Sync Reservation by Arrival Date |
| POST | `/api/sync/creation-date` | Bearer | Sync Reservation by Creation Date |
| POST | `/api/sync/inhouse` | Bearer | Sync Inhouse Guest List |
| POST | `/api/sync/cancelled` | Bearer | Sync Cancelled Reservations |
| POST | `/api/sync/fo-turnover` | Bearer | Sync FO Turnover Report |

### Date parameters (query string)
```
POST /api/sync?fromDate=2024-12-01&toDate=2024-12-31
```
Dates can be `YYYY-MM-DD` or left blank (uses `SYNC_LOOKBACK_DAYS`).

---

## Supabase Tables

| Table | PK | Source |
|-------|----|--------|
| `acb_future_booking` | `rsv_number, rsv_line_number` | ReservationByArrivalDate |
| `acb_reservation_list` | `rsv_number, rsv_line_number` | ReservationByCreationDate |
| `acb_today_inhouse_list` | `rsv_number, rsv_line_number, snapshot_date` | TodayInhouseGuestList |
| `acb_rsv_cancelled_list` | `rsv_number, rsv_line_number` | ReservationCancelled |
| `acb_turnover_list` | `artikel_number, report_date` | FOTurnoverReport |
| `acb_sync_log` | `id` | Internal |

All tables use **upsert** — no duplicate rows.

---

## Authentication

### VHP Auth Code
Generated automatically from env vars using:
```
SHA1(BASE64("VHP:" + username + "@" + userinit + "." + userkey))
```

### Supabase
Uses the **service role key** to bypass Row Level Security. Keep this key secret.

The service logs in as `artotel@service.com` / `service2026` on the Supabase auth side when needed.

---

## Project Structure

```
vhp-sync/
├── src/
│   ├── index.js                 # Entry point + cron
│   ├── routes/
│   │   └── api.js               # Express routes
│   ├── services/
│   │   ├── vhpClient.js         # VHP API calls
│   │   └── syncService.js       # Fetch → map → upsert logic
│   ├── middleware/
│   │   └── auth.js              # Bearer token guard
│   └── utils/
│       ├── vhpAuth.js           # Auth code generator
│       ├── dateHelper.js        # Date formatting
│       └── supabaseClient.js    # Supabase singleton
├── public/
│   └── index.html               # Monitoring dashboard
├── schema.sql                   # Run once in Supabase
├── .env.example
├── package.json
└── README.md
```