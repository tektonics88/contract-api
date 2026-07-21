'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

/** True when Supabase credentials are present. */
function isConfigured() {
  return Boolean(config.supabase.url && config.supabase.serviceKey);
}

// Lazily create a single Supabase client using the service-role key. This key
// bypasses row-level security and must only ever be used server-side.
let client;
function getClient() {
  if (!client) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      const e = new Error('Supabase is not configured');
      e.status = 500;
      e.publicMessage = 'Server is misconfigured (missing database credentials).';
      throw e;
    }
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

/** SHA-256 hex digest of an API key. Deterministic so we can look keys up. */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Looks up an active API key by its plaintext value.
 * @returns {Promise<{id, user_id, key_prefix} | null>} the key row, or null.
 */
async function findActiveApiKey(plaintextKey) {
  const supabase = getClient();
  const keyHash = hashApiKey(plaintextKey);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, key_prefix, active')
    .eq('key_hash', keyHash)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    const e = new Error(`API key lookup failed: ${error.message}`);
    e.status = 500;
    e.publicMessage = 'Could not verify API key.';
    throw e;
  }
  return data || null;
}

/** Updates last_used_at for a key. Fire-and-forget; never blocks a request. */
function touchApiKey(apiKeyId) {
  if (!isConfigured() || !apiKeyId) return;
  getClient()
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyId)
    .then(({ error }) => {
      if (error) console.error('[db] failed to update last_used_at:', error.message);
    });
}

/**
 * Inserts a usage log row. Fire-and-forget: logging must never break the
 * response the client already received.
 */
function logUsage(entry) {
  // Observability only — silently skip when the DB isn't configured so the
  // core /analyze flow can run without Supabase (e.g. dev / no-auth mode).
  if (!isConfigured()) return;
  getClient()
    .from('usage_logs')
    .insert(entry)
    .then(({ error }) => {
      if (error) console.error('[db] failed to write usage log:', error.message);
    });
}

module.exports = {
  getClient,
  isConfigured,
  hashApiKey,
  findActiveApiKey,
  touchApiKey,
  logUsage,
};
