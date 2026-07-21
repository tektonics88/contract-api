'use strict';

const express = require('express');
const multer = require('multer');
const config = require('../config');
const { extractTextFromPdf } = require('../services/pdf');
const { analyzeContract } = require('../services/claude');
const { anchorAnalysis } = require('../services/citations');
const { DISCLAIMER } = require('../services/prompt');
const { requireApiKey } = require('../middleware/auth');
const { apiKeyRateLimiter } = require('../middleware/rateLimit');
const { logUsage } = require('../db/supabase');

const router = express.Router();

// Store uploads in memory — we only need the bytes long enough to extract
// text, and contracts are small. Limit size to avoid abuse.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
});

// Guard against pathological inputs / runaway token costs.
const MAX_TEXT_LENGTH = 200_000; // ~50k tokens of contract text
const MAX_PLAYBOOK_LENGTH = 20_000;

/**
 * Normalizes a caller-supplied playbook into a single text block for the
 * prompt. Accepts a free-text string, a JSON array of strings, or an array of
 * { rule } objects (arrays may arrive as a JSON string via multipart).
 * @returns {string | null}
 */
function normalizePlaybook(raw) {
  if (!raw) return null;

  if (Array.isArray(raw)) {
    const rules = raw
      .map((r) => (typeof r === 'string' ? r : r && typeof r.rule === 'string' ? r.rule : null))
      .filter(Boolean)
      .map((s) => `- ${s.trim()}`);
    return rules.length ? rules.join('\n') : null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // A JSON-encoded array (common when sent as a multipart field).
    if (trimmed.startsWith('[')) {
      try {
        return normalizePlaybook(JSON.parse(trimmed));
      } catch (_) {
        /* fall through — treat as free text */
      }
    }
    return trimmed;
  }

  return null;
}

/**
 * Extracts the optional analysis options from the request body. These work
 * for both JSON bodies and multipart form fields (multer populates req.body).
 */
function parseOptions(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const contractType =
    typeof body.contract_type === 'string' && body.contract_type.trim()
      ? body.contract_type.trim()
      : undefined;
  const partySide =
    typeof body.party_side === 'string' && body.party_side.trim()
      ? body.party_side.trim()
      : undefined;

  let playbook = normalizePlaybook(body.playbook) || undefined;
  if (playbook && playbook.length > MAX_PLAYBOOK_LENGTH) {
    playbook = playbook.slice(0, MAX_PLAYBOOK_LENGTH);
  }

  return { contractType, partySide, playbook };
}

/**
 * Resolves the contract text from either an uploaded PDF (multipart field
 * "file") or a JSON/text body. Returns { text, source }.
 */
async function resolveContractText(req) {
  // 1. PDF upload (multipart form-data, field name "file").
  if (req.file) {
    const isPdf =
      req.file.mimetype === 'application/pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      const e = new Error('Uploaded file is not a PDF');
      e.status = 400;
      e.publicMessage = 'Only PDF files are supported for upload. For other text, send it in the request body.';
      throw e;
    }
    const text = await extractTextFromPdf(req.file.buffer);
    return { text, source: 'pdf' };
  }

  // 2. Raw text — either JSON { "text": "..." } or a text/plain body.
  let text = '';
  if (typeof req.body === 'string') {
    text = req.body;
  } else if (req.body && typeof req.body.text === 'string') {
    text = req.body.text;
  }
  text = text.trim();

  if (!text) {
    const e = new Error('No contract provided');
    e.status = 400;
    e.publicMessage =
      'Provide a contract as a PDF upload (multipart field "file") or as JSON { "text": "..." }.';
    throw e;
  }
  return { text, source: 'text' };
}

/**
 * POST /analyze
 * Accepts a PDF upload OR raw contract text, runs Claude risk analysis,
 * and returns a structured JSON result.
 */
router.post('/', requireApiKey, apiKeyRateLimiter, upload.single('file'), async (req, res, next) => {
  const apiKeyId = req.auth ? req.auth.apiKeyId : null;
  try {
    const { text, source } = await resolveContractText(req);

    if (text.length > MAX_TEXT_LENGTH) {
      const e = new Error('Contract too long');
      e.status = 413;
      e.publicMessage = `Contract text exceeds the ${MAX_TEXT_LENGTH.toLocaleString()} character limit.`;
      throw e;
    }

    const options = parseOptions(req);
    const { analysis, usage, model } = await analyzeContract(text, options);

    // Verify each excerpt against the source text (attaches location +
    // excerpt_verified, plus a citation_summary).
    anchorAnalysis(analysis, text);

    logUsage({
      api_key_id: apiKeyId,
      endpoint: 'POST /analyze',
      status_code: 200,
      source,
      characters_analyzed: text.length,
      model,
      input_tokens: usage ? usage.input_tokens : null,
      output_tokens: usage ? usage.output_tokens : null,
    });

    res.json({
      source,
      characters_analyzed: text.length,
      model,
      usage,
      options_applied: {
        contract_type: options.contractType || null,
        party_side: options.partySide || null,
        playbook_provided: Boolean(options.playbook),
      },
      disclaimer: DISCLAIMER,
      result: analysis,
    });
  } catch (err) {
    // Record failed attempts too (best-effort) for observability.
    logUsage({
      api_key_id: apiKeyId,
      endpoint: 'POST /analyze',
      status_code: err.status || 500,
      error: err.publicMessage || err.message,
    });
    next(err);
  }
});

module.exports = router;
