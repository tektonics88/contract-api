'use strict';

/**
 * Server-side citation verification.
 *
 * The model returns verbatim excerpts; we locate each one in the actual source
 * text and attach a character-offset `location` plus an `excerpt_verified`
 * flag. This turns "trust the model" into "verified against the source" — a UI
 * can highlight the exact span, and an unverified excerpt is a signal the model
 * may have paraphrased or fabricated it.
 */

/**
 * Finds an excerpt in the source text and returns its character range.
 * Tries an exact match first, then a whitespace-insensitive match (PDF
 * extraction and models often differ only in spacing/line breaks).
 * @returns {{char_start: number, char_end: number} | null}
 */
function findExcerptLocation(text, excerpt) {
  if (typeof text !== 'string' || typeof excerpt !== 'string') return null;
  const needle = excerpt.trim();
  if (!needle) return null;

  // 1. Exact substring match.
  const exact = text.indexOf(needle);
  if (exact !== -1) {
    return { char_start: exact, char_end: exact + needle.length };
  }

  // 2. Whitespace-insensitive match: treat any run of whitespace as flexible.
  const escaped = needle
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  try {
    const match = new RegExp(escaped).exec(text);
    if (match) {
      return { char_start: match.index, char_end: match.index + match[0].length };
    }
  } catch (_) {
    // Excerpt too large/complex for a regex — treat as unverified.
  }

  return null;
}

/**
 * Attaches `location` and `excerpt_verified` to every item that carries an
 * excerpt (clauses and playbook_findings), and adds a top-level
 * `citation_summary`. Mutates and returns the analysis object.
 */
function anchorAnalysis(analysis, contractText) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  let total = 0;
  let verified = 0;

  const anchor = (item) => {
    if (!item || typeof item.excerpt !== 'string' || !item.excerpt.trim()) return;
    total += 1;
    const location = findExcerptLocation(contractText, item.excerpt);
    if (location) {
      item.location = location;
      item.excerpt_verified = true;
      verified += 1;
    } else {
      item.location = null;
      item.excerpt_verified = false;
    }
  };

  if (Array.isArray(analysis.clauses)) analysis.clauses.forEach(anchor);
  if (Array.isArray(analysis.playbook_findings)) analysis.playbook_findings.forEach(anchor);

  analysis.citation_summary = {
    total_excerpts: total,
    verified,
    unverified: total - verified,
  };

  return analysis;
}

module.exports = { anchorAnalysis, findExcerptLocation };
