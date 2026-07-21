'use strict';

const { findActiveApiKey, touchApiKey } = require('../db/supabase');

/**
 * Extracts the API key from the request.
 * Supports either:
 *   Authorization: Bearer <key>
 *   x-api-key: <key>
 */
function extractKey(req) {
  const authHeader = req.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const apiKeyHeader = req.get('x-api-key');
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

/**
 * API key authentication middleware. Rejects any request without a valid,
 * active key. On success, attaches req.auth = { apiKeyId, userId, keyPrefix }.
 *
 * Fails closed: any error verifying the key results in rejection, never a
 * silent pass-through.
 */
async function requireApiKey(req, res, next) {
  try {
    const key = extractKey(req);
    if (!key) {
      return res.status(401).json({
        error: 'Missing API key. Provide it as "Authorization: Bearer <key>" or "x-api-key: <key>".',
      });
    }

    const keyRow = await findActiveApiKey(key);
    if (!keyRow) {
      return res.status(401).json({ error: 'Invalid or inactive API key.' });
    }

    req.auth = {
      apiKeyId: keyRow.id,
      userId: keyRow.user_id,
      keyPrefix: keyRow.key_prefix,
    };

    // Record usage timestamp without blocking the request.
    touchApiKey(keyRow.id);

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireApiKey };
