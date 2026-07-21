'use strict';

/**
 * Prompt construction for contract risk analysis.
 *
 * Based on the user-authored analysis prompt, merged with the per-clause
 * `section` and `recommendation` fields chosen in Step 3. Isolated from
 * route/service plumbing so it can be iterated on freely.
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

// The JSON shape the model must return. Kept in sync with what /analyze returns.
const OUTPUT_SCHEMA_DESCRIPTION = `Respond ONLY with valid JSON in this exact structure. Do not include any text outside the JSON object, and do not include markdown code fences:
{
  "clauses": [
    {
      "clause_type": "one of the categories above",
      "risk_level": "low|medium|high",
      "section": "where this appears if identifiable, e.g. 'Section 8.2'; use null if you cannot tell",
      "excerpt": "the relevant verbatim text from the contract (max 50 words)",
      "explanation": "plain-English explanation of why this is or isn't risky, written for someone without a legal background",
      "recommendation": "a concrete, plain-English suggested action, e.g. 'negotiate a mutual liability cap'"
    }
  ],
  "missing_protections": [
    {
      "clause_type": "name of the standard protection that is absent",
      "explanation": "plain-English explanation of why its absence matters for this type of contract",
      "recommendation": "what to add or ask for to address the gap"
    }
  ],
  "overall_risk_level": "low|medium|high",
  "overall_summary": "2-3 sentence plain-English summary of the contract's main risk exposure"
}`;

const SYSTEM_PROMPT =
  'You are a contract risk analyst. You review contracts on behalf of the ' +
  'party being asked to sign and flag anything a reasonable, cautious ' +
  'counterparty would want to know before signing. You are pragmatic, not ' +
  'alarmist. Your recommendations are practical suggestions for negotiation ' +
  'or diligence, not formal legal advice.';

/**
 * Builds the user message sent to Claude for a given contract text.
 * @param {string} contractText
 * @returns {string}
 */
function buildAnalysisPrompt(contractText) {
  return `You will be given the text of a legal contract. Analyze it and identify potential risks for the party receiving this analysis (assume they are the counterparty being asked to sign, not the party who drafted it, unless context makes clear otherwise).

Review the contract for the following clause categories:
${RISK_CATEGORIES.map((c) => `- ${c}`).join('\n')}

For each clause found, provide: the clause_type (one of the categories above), a risk_level, the section reference (if identifiable), the verbatim excerpt (max 50 words), a plain-English explanation of why it is or isn't risky, and a concrete recommendation.

Also flag any STANDARD protections that appear to be MISSING for this type of contract (e.g., no liability cap at all, no termination-for-convenience clause), each with an explanation and a recommendation.

Finally, provide an overall_risk_level (low/medium/high) and a 2-3 sentence plain-English overall_summary of the contract's main risk exposure.

${OUTPUT_SCHEMA_DESCRIPTION}

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
  OUTPUT_SCHEMA_DESCRIPTION,
};
