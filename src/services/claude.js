'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const { SYSTEM_PROMPT, buildAnalysisPrompt } = require('./prompt');

// Instantiate lazily so the app can boot (e.g. for /health) even if the key
// isn't set, and so tests can run without a real client.
let client;
function getClient() {
  if (!client) {
    if (!config.anthropic.apiKey) {
      const e = new Error('ANTHROPIC_API_KEY is not set');
      e.status = 500;
      e.publicMessage = 'Server is misconfigured (missing Claude API key).';
      throw e;
    }
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

/**
 * Best-effort extraction of a JSON object from a model text response.
 * Handles the common cases: clean JSON, JSON wrapped in ```json fences,
 * or JSON with incidental surrounding text.
 */
function parseJsonResponse(text) {
  const trimmed = text.trim();

  // Strip markdown code fences if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    // Fall back to the first balanced-looking {...} span.
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Model response was not valid JSON');
  }
}

/**
 * Sends contract text to Claude and returns the parsed structured analysis.
 * @param {string} contractText
 * @param {{contractType?: string, partySide?: string, playbook?: string}} [options]
 * @returns {Promise<object>} parsed analysis matching the documented schema
 */
async function analyzeContract(contractText, options = {}) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildAnalysisPrompt(contractText, options) }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  const rawText = textBlock ? textBlock.text : '';

  let analysis;
  try {
    analysis = parseJsonResponse(rawText);
  } catch (err) {
    const e = new Error(`Could not parse Claude response: ${err.message}`);
    e.status = 502;
    e.publicMessage = 'The analysis service returned an unexpected response. Please retry.';
    e.rawText = rawText;
    throw e;
  }

  return {
    analysis,
    usage: message.usage, // { input_tokens, output_tokens } — used for logging later
    model: message.model,
  };
}

module.exports = { analyzeContract, parseJsonResponse };
