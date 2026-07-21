'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Per-API-key rate limiter.
 *
 * Must run AFTER requireApiKey so req.auth is populated — the limit is keyed
 * on the API key id, so each key gets its own independent budget. Falls back
 * to the client IP if auth somehow didn't run.
 *
 * NOTE: uses the default in-memory store, which is per-process. That's fine
 * for a single-instance MVP. Running multiple instances would need a shared
 * store (e.g. Redis) so limits are enforced across processes.
 */
const apiKeyRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true, // adds RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => (req.auth && req.auth.apiKeyId) || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please slow down and retry shortly.',
      limit: config.rateLimit.max,
      window_ms: config.rateLimit.windowMs,
    });
  },
});

module.exports = { apiKeyRateLimiter };
