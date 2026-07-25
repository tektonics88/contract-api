# Roadmap

A snapshot of what's shipped and what's left. Effort tags: **S** (hours), **M** (a day or two), **L** (multi-day / architectural).

## Shipped

- `POST /analyze` — PDF / DOCX / text input → structured risk analysis
- API-key auth + Postgres schema (users, api_keys, usage_logs); per-key rate limiting
- Analysis prompt: 12 clause categories, counterparty-perspective framing
- **Playbook review** — flag deviations from the caller's own policy positions
- **Contract-type + party-side** options (auto-detects type when omitted)
- **Verified citations** — every excerpt located in the source (`location` + `excerpt_verified`) with a `citation_summary`; per-finding `confidence`
- **Redline suggestions** (`include_redlines`) — ready-to-paste clause language
- **Obligations & key-date extraction** — deadlines, renewals, payment dates, per-party duties
- **Structured outputs** — schema-guaranteed JSON via `output_config.format`
- Dev no-auth mode, sample contract (txt/pdf/docx), e2e test script, unit tests (42), README

## Immediate

| Item | Effort | Notes |
|---|---|---|
| **Live-run validation with a real key** | S | The one thing unit tests can't cover — confirms the live Claude round-trip, structured outputs, citation matching, and extraction quality. Do this first. |
| Idempotency keys + request IDs on every response | S | Integrator hygiene; makes retries safe. |
| API versioning (`/v1` prefix) | S | Cheap insurance before external callers. |

## High-value next

| Item | Effort | Notes |
|---|---|---|
| **"Chat with the contract"** (`/ask`) | M | Follow-up Q&A about an analyzed contract. High delight, builds on existing pieces. |
| **Negotiation intelligence** | M | Per-clause negotiability + market-standard fallback positions. Turns the tool into a negotiation coach. |
| **Redlined DOCX output** | L | Emit an edit-ready Word doc from the redline data. The "wow" deliverable for legal teams. |
| **Template / version comparison** | M | Diff a contract against the company standard, or v1 vs v2 across negotiation rounds. |
| Numeric risk score (0–100) + per-category breakdown | S | Sortable/dashboard-friendly, complements low/med/high. |

## Production hardening

| Item | Effort | Notes |
|---|---|---|
| **Data-handling controls** | M | No-store mode, retention config, optional PII redaction. Real procurement blocker for legal docs. (Note: we already only log metadata, never contract text.) |
| Async jobs + webhooks | L | Job ID → background processing → callback POST. Needed for large docs and batch. |
| Batch endpoint (`/batch`) | M | Analyze many contracts in one call. |
| Prompt versioning + audit trail | M | Persist which prompt/model produced each result; store analyses for reproducibility. |
| Self-verification pass | M | Second model pass to cut false positives. Add only if real usage shows a precision gap. |
| Shared-store rate limiting (Redis) | S | Current limiter is in-memory / per-process; needed once running multiple instances. |
| Prompt caching | S | Cache reused playbooks/templates for cost + latency at scale. |

## Later / scale

| Item | Effort | Notes |
|---|---|---|
| OCR for scanned PDFs | M | Tesseract or a hosted OCR; unblocks image-only documents (currently 400). |
| Streaming responses | M | Stream the analysis for interactive UIs. |
| Multi-language contracts | M | Detect + analyze non-English agreements. |
| Metering & billing (Stripe) | L | `usage_logs` already captures per-request tokens as the foundation. |
| Per-key analytics / dashboard | M | Usage and cost visibility per customer. |

## Deliberately out of scope (for now)

- Billing/Stripe wiring (deferred by design)
- A UI / frontend (this is an API)
