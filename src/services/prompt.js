'use strict';

/**
 * Prompt construction for contract risk analysis.
 *
 * This module is intentionally isolated from route/service plumbing so the
 * prompt can be iterated on freely. Everything the model is asked to produce
 * is described here and kept in sync with what the route promises callers.
 */

// The JSON shape we ask Claude to return.
const OUTPUT_SCHEMA_DESCRIPTION = `Return ONLY a valid JSON object (no markdown, no prose before or after) with this exact shape:
{
  "overall_risk": "low" | "medium" | "high",
  "risk_summary": "2-4 sentence plain-English explanation of the overall risk level and the main drivers",
  "flagged_clauses": [
    {
      "clause_name": "short label, e.g. 'Indemnification' or 'Auto-renewal'",
      "risk_level": "low" | "medium" | "high",
      "section": "where this appears if identifiable, e.g. 'Section 8.2' or 'Termination'; use null if you cannot tell",
      "excerpt": "the actual verbatim text from the contract that this concerns",
      "explanation": "plain-English explanation of why this is risky or unusual",
      "recommendation": "a concrete, plain-English suggested action, e.g. 'negotiate a mutual liability cap' or 'request 30-day termination notice'"
    }
  ],
  "missing_protections": [
    {
      "protection": "short name of a standard protection that is absent",
      "explanation": "plain-English explanation of why its absence matters for a contract of this type",
      "recommendation": "what to add or ask for to address the gap"
    }
  ]
}`;

// Categories to explicitly scrutinize. The model may still flag other notable
// clauses beyond this list.
const RISK_CATEGORIES = [
  'Indemnification',
  'Liability caps / limitation of liability',
  'Auto-renewal',
  'Termination terms',
  'Non-compete',
  'IP assignment',
  'Dispute resolution / arbitration',
  'Confidentiality / NDA scope',
  'Payment terms / late fees',
  'Governing law / jurisdiction',
  'Warranties / disclaimers',
  'Assignment / change of control',
];

const SYSTEM_PROMPT = `You are an experienced contracts attorney performing a risk review for a business client. You read contracts carefully and flag anything that a reasonable, cautious counterparty would want to know about before signing. You are pragmatic, not alarmist: reserve "high" risk for terms that are genuinely one-sided, unusual, or expose the client to significant liability. Your recommendations are practical suggestions for negotiation or diligence, not formal legal advice.`;

/**
 * Builds the user message sent to Claude for a given contract text.
 * @param {string} contractText
 * @returns {string}
 */
function buildAnalysisPrompt(contractText) {
  return `Analyze the following contract for risk.

Pay particular attention to these categories of clauses (flag any that are present and notable):
${RISK_CATEGORIES.map((c) => `- ${c}`).join('\n')}

You may also flag any other clause that a cautious party would find risky or unusual.

For each flagged clause, include a section reference (if you can identify one), the verbatim excerpt, why it is risky, and a concrete recommendation.

Also identify standard protections a reasonable contract of this type SHOULD have but appears to be missing, with a recommendation for each.

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
