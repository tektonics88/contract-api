'use strict';

/**
 * Prompt construction for contract risk analysis.
 *
 * NOTE: This is the Step 2 *placeholder* prompt. Step 3 is dedicated to
 * iterating on the exact risk categories and output format with the user.
 * It's isolated here so refining it doesn't touch route/service plumbing.
 */

// The JSON shape we ask Claude to return. Documented here so it stays in sync
// with what the route promises to callers.
const OUTPUT_SCHEMA_DESCRIPTION = `Return ONLY a valid JSON object (no markdown, no prose before or after) with this exact shape:
{
  "overall_risk": "low" | "medium" | "high",
  "risk_summary": "2-4 sentence plain-English explanation of the overall risk level and the main drivers",
  "flagged_clauses": [
    {
      "clause_name": "short label, e.g. 'Indemnification' or 'Auto-renewal'",
      "risk_level": "low" | "medium" | "high",
      "excerpt": "the actual verbatim text from the contract that this concerns",
      "explanation": "plain-English explanation of why this is risky or unusual"
    }
  ],
  "missing_protections": [
    {
      "protection": "short name of a standard protection that is absent",
      "explanation": "plain-English explanation of why its absence matters for a contract of this type"
    }
  ]
}`;

const RISK_CATEGORIES = [
  'Indemnification',
  'Liability caps / limitation of liability',
  'Auto-renewal',
  'Termination terms',
  'Non-compete',
  'IP assignment',
  'Dispute resolution / arbitration',
];

const SYSTEM_PROMPT = `You are an experienced contracts attorney performing a risk review for a business client. You read contracts carefully and flag anything that a reasonable, cautious counterparty would want to know about before signing. You are pragmatic, not alarmist: reserve "high" risk for terms that are genuinely one-sided, unusual, or expose the client to significant liability.`;

/**
 * Builds the user message sent to Claude for a given contract text.
 * @param {string} contractText
 * @returns {string}
 */
function buildAnalysisPrompt(contractText) {
  return `Analyze the following contract for risk.

Pay particular attention to these categories of clauses (flag any that are present and notable):
${RISK_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Also identify standard protections a reasonable contract of this type SHOULD have but appears to be missing.

Then give an overall risk level (low/medium/high) with plain-English reasoning.

${OUTPUT_SCHEMA_DESCRIPTION}

--- CONTRACT START ---
${contractText}
--- CONTRACT END ---`;
}

module.exports = {
  SYSTEM_PROMPT,
  buildAnalysisPrompt,
  RISK_CATEGORIES,
  OUTPUT_SCHEMA_DESCRIPTION,
};
