'use strict';

require('dotenv').config();

/**
 * Central place to read and validate environment configuration.
 * Keeping this in one module makes it obvious what the service needs to run.
 */
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Dev escape hatch: when true, /analyze skips API-key auth entirely so the
  // core analysis flow can be tested without Supabase. Opt-in only, and
  // refused in production (see index.js). NEVER enable this in production.
  disableAuth: process.env.DISABLE_AUTH === 'true',

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    // Default model for contract analysis. Overridable via env for iteration.
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) || 8192,
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    // Service-role key: used server-side only, never exposed to clients.
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  rateLimit: {
    // Requests allowed per API key within the window.
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 30,
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
  },

  // Max upload size for contract files (bytes). Default 10 MB.
  maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 10 * 1024 * 1024,
};

module.exports = config;
