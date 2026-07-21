# Contract Review API

An MVP backend service that analyzes legal contracts and flags risks using the
Claude API. Send a PDF or plain text to `POST /analyze` and get back a
structured JSON risk report: risky/unusual clauses, missing standard
protections, and an overall risk level with plain-English reasoning.

> ⚠️ This tool produces an automated risk review to aid diligence and
> negotiation. It is **not legal advice** and is no substitute for a qualified
> attorney.

## Stack

- **Node.js + Express** — small, single-language stack
- **Claude API** (`@anthropic-ai/sdk`) — the analysis engine
- **pdf-parse** — text extraction from PDF uploads
- **Supabase (Postgres)** — users, API keys, usage logs
- **express-rate-limit** — per-API-key rate limiting

## How it works

```
POST /analyze
  → API-key auth (Supabase lookup)
  → per-key rate limit
  → resolve contract text (parse PDF upload OR read JSON text)
  → send to Claude with a structured risk-analysis prompt
  → parse structured JSON, log usage
  → return the report
```

## Project structure

```
contract-api/
├── db/
│   └── schema.sql              # Supabase/Postgres tables (run once)
├── samples/
│   ├── sample-contract.txt     # a deliberately risky sample contract
│   └── sample-contract.pdf     # PDF version (generated from the .txt)
├── scripts/
│   ├── create-api-key.js       # provision a user + issue an API key
│   ├── make-sample-pdf.js      # regenerate sample-contract.pdf
│   └── test-analyze.js         # end-to-end smoke test
└── src/
    ├── index.js                # server bootstrap
    ├── app.js                  # Express app + error handling
    ├── config.js               # env configuration
    ├── routes/analyze.js       # POST /analyze
    ├── middleware/
    │   ├── auth.js             # API-key authentication
    │   └── rateLimit.js        # per-key rate limiting
    ├── services/
    │   ├── pdf.js              # PDF text extraction
    │   ├── prompt.js           # analysis prompt + output schema
    │   └── claude.js           # Claude API integration
    └── db/supabase.js          # Supabase client + queries
```

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

Then edit `.env` — at minimum set `ANTHROPIC_API_KEY`.

### 2. Provision the database (Supabase)

Create a project at [supabase.com](https://supabase.com), then run
`db/schema.sql` in the Supabase **SQL editor** (or via `psql`). This creates the
`users`, `api_keys`, and `usage_logs` tables.

Add your Supabase URL and **service-role** key to `.env`
(`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).

### 3. Issue an API key

```bash
node scripts/create-api-key.js you@example.com "my first key"
```

This creates the user (if new) and prints a key like `sk_...` **once** — save
it. Only a SHA-256 hash is stored; the plaintext is never recoverable.

## Running

```bash
npm start      # production-style
npm run dev    # auto-reload via nodemon
```

Health check: `curl localhost:3000/health` → `{"status":"ok"}`

## Testing without Supabase (dev mode)

Want to try the analysis before setting up Supabase? Set `DISABLE_AUTH=true`.
This skips API-key auth and usage logging so you only need `ANTHROPIC_API_KEY`:

```bash
DISABLE_AUTH=true npm start
```

The server refuses to start with `DISABLE_AUTH=true` when `NODE_ENV=production`.

## End-to-end test

With the server running:

```bash
# Dev mode (no auth):
node scripts/test-analyze.js

# With auth on:
API_KEY=sk_your_key node scripts/test-analyze.js
```

It checks `/health`, the 401-without-key path, and runs analysis on the sample
contract as both raw text and a PDF upload, printing the flagged clauses.

## API reference

### `POST /analyze`

**Auth:** `Authorization: Bearer <key>` or `x-api-key: <key>` (unless
`DISABLE_AUTH=true`).

**Request — two ways to send a contract:**

Raw text (JSON):

```bash
curl -X POST localhost:3000/analyze \
  -H "Authorization: Bearer sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"text": "MASTER SERVICES AGREEMENT ..."}'
```

PDF upload (multipart, field name `file`):

```bash
curl -X POST localhost:3000/analyze \
  -H "Authorization: Bearer sk_your_key" \
  -F "file=@samples/sample-contract.pdf"
```

**Response (200):**

```json
{
  "source": "pdf",
  "characters_analyzed": 3457,
  "model": "claude-sonnet-5",
  "usage": { "input_tokens": 1234, "output_tokens": 890 },
  "result": {
    "overall_risk": "high",
    "risk_summary": "This agreement is heavily one-sided in the Provider's favor ...",
    "flagged_clauses": [
      {
        "clause_name": "Indemnification",
        "risk_level": "high",
        "section": "Section 5",
        "excerpt": "Client shall defend, indemnify, and hold harmless Provider ...",
        "explanation": "One-way indemnity requiring the Client to cover even the Provider's own negligence.",
        "recommendation": "Make indemnification mutual and carve out the Provider's negligence."
      }
    ],
    "missing_protections": [
      {
        "protection": "Mutual limitation of liability",
        "explanation": "The Client's liability is uncapped while the Provider's is capped at $100.",
        "recommendation": "Negotiate a mutual, reasonable liability cap."
      }
    ]
  }
}
```

**Error responses** use `{ "error": "..." }` with appropriate status codes:
`400` (bad/empty input, unparseable PDF), `401` (missing/invalid key),
`413` (contract too long), `429` (rate limit exceeded), `500`/`502`
(server/analysis error).

### Risk categories scrutinized

Indemnification · liability caps · auto-renewal · termination · non-compete ·
IP assignment · dispute resolution/arbitration · confidentiality/NDA scope ·
payment/late fees · governing law/jurisdiction · warranties/disclaimers ·
assignment/change of control. Other notable clauses may also be flagged.

## Rate limiting

Each API key gets `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`
(default 30 / 60s). Standard `RateLimit-*` headers are returned; exceeding the
limit yields `429`. The limiter uses an in-memory store — fine for a single
instance. For multiple instances, use a shared store (e.g. Redis).

## Limitations / notes (MVP)

- **No OCR** — scanned/image-only PDFs yield no text and return a `400`.
- **Single-instance rate limiting** (in-memory) — see above.
- **No billing** — Stripe/metering is intentionally out of scope for now
  (usage is logged to `usage_logs` as a foundation for it later).
- Tune the prompt in `src/services/prompt.js`; switch models via
  `ANTHROPIC_MODEL` (e.g. an Opus model for maximum reasoning quality).
