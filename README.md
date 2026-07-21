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

**Optional parameters** (JSON body fields, or multipart form fields alongside `file`):

| Field | Type | Effect |
|-------|------|--------|
| `contract_type` | string | Analyze as this type (e.g. `"NDA"`, `"MSA"`). If omitted, the type is auto-detected and returned in `result.contract_type`. |
| `party_side` | string | Analyze from this party's perspective (e.g. `"Client"`, `"Employee"`, `"Buyer"`). If omitted, defaults to the party being asked to sign. |
| `playbook` | string \| string[] | Your policy positions. Each is checked against the contract and returned in `result.playbook_findings` as `meets` / `violates` / `not_addressed`. Accepts a free-text block or an array of rule strings. |

```bash
curl -X POST localhost:3000/analyze \
  -H "Authorization: Bearer sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "MASTER SERVICES AGREEMENT ...",
    "contract_type": "Master Services Agreement",
    "party_side": "Client",
    "playbook": [
      "Liability must be capped at no more than 12 months of fees.",
      "Termination for convenience must allow at least 30 days notice."
    ]
  }'
```

**Response (200):**

```json
{
  "source": "pdf",
  "characters_analyzed": 3457,
  "model": "claude-sonnet-5",
  "usage": { "input_tokens": 1234, "output_tokens": 890 },
  "options_applied": {
    "contract_type": "Master Services Agreement",
    "party_side": "Client",
    "playbook_provided": true
  },
  "disclaimer": "This automated analysis is provided to aid contract review and is not legal advice ...",
  "result": {
    "contract_type": "Master Services Agreement",
    "party_side": "Client (the party being asked to sign)",
    "overall_risk_level": "high",
    "overall_summary": "This agreement is heavily one-sided in the Provider's favor ...",
    "citation_summary": { "total_excerpts": 9, "verified": 9, "unverified": 0 },
    "clauses": [
      {
        "clause_type": "Indemnification",
        "risk_level": "high",
        "confidence": "high",
        "section": "Section 5",
        "excerpt": "Client shall defend, indemnify, and hold harmless Provider ...",
        "explanation": "One-way indemnity requiring the Client to cover even the Provider's own negligence.",
        "recommendation": "Make indemnification mutual and carve out the Provider's negligence.",
        "location": { "char_start": 1620, "char_end": 1698 },
        "excerpt_verified": true
      }
    ],
    "missing_protections": [
      {
        "clause_type": "Mutual limitation of liability",
        "explanation": "The Client's liability is uncapped while the Provider's is capped at $100.",
        "recommendation": "Negotiate a mutual, reasonable liability cap."
      }
    ],
    "playbook_findings": [
      {
        "rule": "Liability must be capped at no more than 12 months of fees.",
        "status": "violates",
        "excerpt": "IN NO EVENT SHALL PROVIDER'S TOTAL LIABILITY EXCEED ONE HUNDRED DOLLARS ($100).",
        "explanation": "The Provider's cap is a flat $100 and the Client's liability is uncapped.",
        "recommendation": "Replace with a mutual cap tied to fees paid in the prior 12 months.",
        "location": { "char_start": 1993, "char_end": 2071 },
        "excerpt_verified": true
      }
    ]
  }
}
```

**Trust features:**
- **`confidence`** (per clause) — the model's confidence the finding is accurate, for triage.
- **`location` + `excerpt_verified`** — every excerpt is located in the source text **server-side**. `location` gives character offsets a UI can highlight; `excerpt_verified: false` means the excerpt could not be found in the source (a signal the model may have paraphrased it). `citation_summary` totals this per response.
- **`playbook_findings`** — per-rule compliance against your own standards, not just generic risk.

> The response is not legal advice — see the `disclaimer` field returned with every analysis.

**Error responses** use `{ "error": "..." }` with appropriate status codes:
`400` (bad/empty input, unparseable PDF), `401` (missing/invalid key),
`413` (contract too long), `429` (rate limit exceeded), `500`/`502`
(server/analysis error).

### Risk categories scrutinized

Indemnification · limitation of liability / liability caps · termination ·
auto-renewal · non-compete / non-solicit · IP assignment / ownership ·
dispute resolution (arbitration, venue) · governing law / jurisdiction ·
payment terms and penalties · confidentiality obligations · warranty
disclaimers · assignment / change of control.

By default the analysis is from the perspective of the party being asked to
sign; override it with the `party_side` parameter.

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
