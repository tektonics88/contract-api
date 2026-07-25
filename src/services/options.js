'use strict';

/**
 * Parsing/normalization of the optional /analyze request options
 * (contract_type, party_side, playbook, include_redlines). Pure functions,
 * isolated here so they can be unit-tested without the HTTP layer.
 */

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
 * @param {{body?: object}} req
 * @returns {{contractType?: string, partySide?: string, playbook?: string, includeRedlines: boolean}}
 */
function parseOptions(req) {
  const body = req && req.body && typeof req.body === 'object' ? req.body : {};

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

  // Accepts JSON boolean true or the string "true" (multipart form field).
  const includeRedlines = body.include_redlines === true || body.include_redlines === 'true';

  return { contractType, partySide, playbook, includeRedlines };
}

module.exports = { normalizePlaybook, parseOptions, MAX_PLAYBOOK_LENGTH };
