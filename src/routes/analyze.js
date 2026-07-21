'use strict';

const express = require('express');
const multer = require('multer');
const config = require('../config');
const { extractTextFromPdf } = require('../services/pdf');
const { analyzeContract } = require('../services/claude');

const router = express.Router();

// Store uploads in memory — we only need the bytes long enough to extract
// text, and contracts are small. Limit size to avoid abuse.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
});

// Guard against pathological inputs / runaway token costs.
const MAX_TEXT_LENGTH = 200_000; // ~50k tokens of contract text

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
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { text, source } = await resolveContractText(req);

    if (text.length > MAX_TEXT_LENGTH) {
      const e = new Error('Contract too long');
      e.status = 413;
      e.publicMessage = `Contract text exceeds the ${MAX_TEXT_LENGTH.toLocaleString()} character limit.`;
      throw e;
    }

    const { analysis, usage, model } = await analyzeContract(text);

    res.json({
      source,
      characters_analyzed: text.length,
      model,
      usage,
      result: analysis,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
