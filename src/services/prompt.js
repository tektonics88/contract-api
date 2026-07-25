'use strict';

/**
 * Prompt construction for contract risk analysis.
 *
 * Supports three request-time options:
 *   - contractType: caller-supplied type (else the model detects it)
 *   - partySide:    whose perspective to analyze from (else "the party being
 *                   asked to sign")
 *   - playbook:     the customer's own policy positions to check compliance
 *                   against (produces per-rule playbook_findings)
 *
 * Isolated from route/service plumbing so it can be iterated on freely.
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
 * Builds the JSON output schema description.
 * @param {boolean} hasPlaybook toggles the playbook_findings array
 * @param {boolean} includeRedlines toggles the suggested_redline fields
 */
function buildOutputSchema(hasPlaybook, includeRedlines) {
  const clauseRedline = includeRedlines
    ? `,
      "suggested_redline": "proposed replacement or additional contract language that would reduce this risk, written so it could be pasted into the contract; null if not applicable"`
    : '';

  const playbookRedline = includeRedlines
    ? `,
      "suggested_redline": "proposed contract language that would bring this in line with the policy position; null if status is 'meets' or not applicable"`
    : '';

  const playbookBlock = hasPlaybook
    ? `,
  "playbook_findings": [
    {
      "rule": "the caller's policy position being evaluated, restated concisely",
      "status": "meets|violates|not_addressed",
      "excerpt": "verbatim contract text relevant to this rule (max 50 words), or null if not_addressed",
      "explanation": "plain-English explanation of how the contract does or does not satisfy this position",
      "recommendation": "what to change or add to bring the contract in line with the position"${playbookRedline}
    }
  ]`
    : '';

  return `Respond ONLY with valid JSON in this exact structure. Do not include any text outside the JSON object, and do not include markdown code fences:
{
  "contract_type": "your best determination of the contract type, e.g. 'Master Services Agreement', 'NDA', 'Employment Agreement'",
  "party_side": "the perspective this analysis is written from, e.g. 'Client (receiving party)'",
  "overall_risk_level": "low|medium|high",
  "overall_summary": "2-3 sentence plain-English summary of the contract's main risk exposure",
  "clauses": [
    {
      "clause_type": "one of the categories above",
      "risk_level": "low|medium|high",
      "confidence": "low|medium|high — your confidence that this finding is accurate and correctly characterized",
      "section": "where this appears if identifiable, e.g. 'Section 8.2'; use null if you cannot tell",
      "excerpt": "the relevant verbatim text copied EXACTLY from the contract (max 50 words)",
      "explanation": "plain-English explanation of why this is or isn't risky, for someone without a legal background",
      "recommendation": "a concrete, plain-English suggested action"${clauseRedline}
    }
  ],
  "missing_protections": [
    {
      "clause_type": "name of the standard protection that is absent",
      "explanation": "plain-English explanation of why its absence matters for this type of contract",
      "recommendation": "what to add or ask for to address the gap"
    }
  ]${playbookBlock}
}

The "excerpt" fields must be copied VERBATIM from the contract text — do not paraphrase, summarize, or fix typos — so they can be located in the source document.`;
}

/**
 * Builds the user message sent to Claude.
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
    ? `The contract type is: ${contractType}. Tailor the analysis and the "missing standard protections" to what is standard for that type. Echo it back in "contract_type".`
    : `First, determine the contract type and return it in "contract_type". Tailor the analysis and the "missing standard protections" to what is standard for that type.`;

  const playbookBlock = playbook
    ? `

The party has provided the following policy positions (their "playbook"). Evaluate the contract against EACH position and return one entry per position in "playbook_findings", marking whether the contract meets it, violates it, or does not address it:
--- PLAYBOOK START ---
${playbook}
--- PLAYBOOK END ---`
    : '';

  return `You will be given the text of a legal contract. Analyze it and identify potential risks.

${perspective}

${typeLine}

Review the contract for the following clause categories:
${RISK_CATEGORIES.map((c) => `- ${c}`).join('\n')}

For each clause found, provide: the clause_type, a risk_level, your confidence, the section reference (if identifiable), the verbatim excerpt (max 50 words), a plain-English explanation, and a concrete recommendation.

Also flag any STANDARD protections that appear to be MISSING for this type of contract (e.g., no liability cap at all, no termination-for-convenience clause), each with an explanation and a recommendation.

Finally, provide an overall_risk_level (low/medium/high) and a 2-3 sentence overall_summary.${playbookBlock}${
    includeRedlines
      ? '\n\nFor each flagged clause (and each playbook finding that is violated), also provide a "suggested_redline": concrete replacement or additional contract language, written so it could be pasted directly into the contract to reduce the risk or satisfy the policy.'
      : ''
  }

${buildOutputSchema(Boolean(playbook), Boolean(includeRedlines))}

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
