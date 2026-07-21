-- Contract Review API — database schema
-- Run this in the Supabase SQL editor (or psql) to provision the tables.
--
-- Design notes:
--   * API keys are never stored in plaintext. We store a SHA-256 hash for
--     lookup plus a short non-secret prefix for display/identification.
--   * usage_logs records every /analyze attempt for observability and,
--     later, billing.

-- gen_random_uuid() is built in on Postgres 13+ (Supabase). pgcrypto is also
-- available if you prefer; no extension is required for this schema.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- api_keys
-- ---------------------------------------------------------------------------
create table if not exists api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  -- SHA-256 hex digest of the full secret key. Unique so lookups are O(1).
  key_hash      text not null unique,
  -- Non-secret leading chars of the key, e.g. "sk_live_a1b2", for display.
  key_prefix    text not null,
  name          text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists api_keys_user_id_idx on api_keys(user_id);

-- ---------------------------------------------------------------------------
-- usage_logs
-- ---------------------------------------------------------------------------
create table if not exists usage_logs (
  id                   uuid primary key default gen_random_uuid(),
  api_key_id           uuid references api_keys(id) on delete set null,
  endpoint             text not null,
  status_code          integer not null,
  source               text,             -- 'pdf' | 'text'
  characters_analyzed  integer,
  model                text,
  input_tokens         integer,
  output_tokens        integer,
  error                text,             -- populated on failures
  created_at           timestamptz not null default now()
);

create index if not exists usage_logs_api_key_id_idx on usage_logs(api_key_id);
create index if not exists usage_logs_created_at_idx on usage_logs(created_at);
