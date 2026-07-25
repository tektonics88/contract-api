'use strict';

/**
 * Prompt construction for contract risk analysis.
 *
 * The response STRUCTURE is enforced by a JSON schema via Claude's structured
 * outputs (see services/schema.js) — this module supplies the instructions and
 * content guidance. Supports request-time options: contractType, partySide,
 * playbook, includeRedlines.
 */

// Shown to the caller (top-level `disclaimer` in the API response) and framed
// into the system prompt. This is an automated aid, not legal advice.
const DISCLAIMER =
  'This automated analysis is provided to aid contract review and is not legal ' +
  'advice. It may miss issues or misjudge risk. Consult a qualified attorney ' +
  'before relying on it or signing any agreement.';

// The clause categories the analyst is asked to scrutinize.
const RISK_CATEGORIES = [
  'Indemnification',
  'Limitation of liability / liability caps',
  'Termination terms',
  'Auto-renewal clauses',
  'Non-compete / non-solicit',
  'IP assignment / ownership',
  'Dispute resolution (arbitration, venue)',
  'Governing law / jurisdiction',
  'Payment terms and penalties',
  'Confidentiality obligations',
  'Warranty disclaimers',
  'Assignment / change of control',
];

const SYSTEM_PROMPT =
  'You are a contract risk analyst. You review contracts on behalf of the ' +
  'party being asked to sign and flag anything a reasonable, cautious ' +
  'counterparty would want to know before signing. You are pragmatic, not ' +
  'alarmist. Your recommendations are practical suggestions for negotiation ' +
  'or diligence, not formal legal advice.';

/**
 * Builds the user message sent to Claude. The output structure is enforced
 * separately by the JSON schema (structured outputs); this focuses the model
 * on WHAT to produce.
 * @param {string} contractText
 * @param {{contractType?: string, partySide?: string, playbook?: string, includeRedlines?: boolean}} [options]
 * @returns {string}
 */
function buildAnalysisPrompt(contractText, options = {}) {
  const { contractType, partySide, playbook, includeRedlines } = options;

  const perspective = partySide
    ? `Analyze the contract from the perspective of: ${partySide}. Flag what is risky or unfavorable for that party specifically.`
    : `Analyze the contract from the perspective of the party being asked to sign it (the counterparty, not the party who drafted it, unless context makes clear otherwise).`;

  const typeLine = contractType
    ? `The contract type is: ${contractType}. Tailor the analysis and the "missing standard protections" to what is standard for that type, and echo it back in "contract_type".`
    : `Determine the contract type and return it in "contract_type". Tailor the analysis and the "missing standard protections" to what is standard for that type.`;

  const playbookBlock = playbook
    ? `

The party has provided the following policy positions (their "playbook"). Evaluate the contract against EACH position and return one entry per position in "playbook_findings", marking whether the contract meets it, violates it, or does not address it:
--- PLAYBOOK START ---
${playbook}
--- PLAYBOOK END ---`
    : '';

  const redlineBlock = includeRedlines
    ? '\n\nFor each flagged clause (and each violated playbook finding), also provide a "suggested_redline": concrete replacement or additional contract language, written so it could be pasted directly into the contract.'
    : '';

  return `You will be given the text of a legal contract. Produce a structured risk analysis.

${perspective}

${typeLine}

1. RISK CLAUSES — Review the contract for these categories and populate "clauses" with any that are present and notable:
${RISK_CATEGORIES.map((c) => `- ${c}`).join('\n')}
For each, give the clause_type, risk_level, your confidence, the section reference (or null), a verbatim excerpt (max 50 words), a plain-English explanation, and a concrete recommendation.

2. MISSING PROTECTIONS — Populate "missing_protections" with standard protections that appear to be absent for this type of contract (e.g., no liability cap, no termination-for-convenience clause), each with an explanation and recommendation.

3. KEY DATES — Populate "key_dates" with every date or deadline a party must track: effective date, expiration, auto-renewal, notice/cancellation windows, payment due dates, and milestones. Give an absolute ISO date when determinable, otherwise describe the timing (e.g. "90 days before end of term").

4. OBLIGATIONS — Populate "obligations" with the ongoing duties each party takes on (who must do what, and when/under what trigger).

5. OVERALL — Provide overall_risk_level (low/medium/high) and a 2-3 sentence overall_summary.${playbookBlock}${redlineBlock}

Every "excerpt" field must be copied VERBATIM from the contract text — do not paraphrase, summarize, or fix typos — so it can be located in the source document. If a list has no items, return an empty array.

Contract text follows:
---
${contractText}
---`;
}

module.exports = {
  SYSTEM_PROMPT,
  DISCLAIMER,
  buildAnalysisPrompt,
  RISK_CATEGORIES,
};
