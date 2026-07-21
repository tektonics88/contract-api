'use strict';

const express = require('express');

const router = express.Router();

/**
 * POST /analyze
 *
 * Placeholder stub. In Step 2 this will:
 *   - accept a PDF upload or raw text,
 *   - extract text from the PDF,
 *   - send the contract to the Claude API with a structured prompt,
 *   - return a structured JSON risk analysis.
 */
router.post('/', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet — coming in Step 2' });
});

module.exports = router;
