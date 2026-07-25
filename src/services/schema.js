'use strict';

/**
 * JSON Schema for the /analyze response, used with Claude's structured outputs
 * (output_config.format) to GUARANTEE the model returns valid, conformant JSON
 * — eliminating the parse-failure class of errors.
 *
 * The schema is built per-request so it exactly matches the options in play
 * (playbook_findings and suggested_redline are only present when requested).
 * Field semantics live in the `description`s so the model gets them directly
 * from the schema. Every object sets additionalProperties:false and lists all
 * keys as required (strict mode); optional values use nullable types.
 */

const RISK_ENUM = ['low', 'medium', 'high'];

const strObj = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

/**
 * @param {{playbook?: string, includeRedlines?: boolean}} [options]
 * @returns {object} a JSON Schema object
 */
function buildOutputJsonSchema(options = {}) {
  const includeRedlines = Boolean(options.includeRedlines);
  const hasPlaybook = Boolean(options.playbook);

  const clauseProps = {
    clause_type: { type: 'string', description: 'One of the reviewed clause categories.' },
    risk_level: { type: 'string', enum: RISK_ENUM },
    confidence: {
      type: 'string',
      enum: RISK_ENUM,
      description: 'Your confidence that this finding is accurate and correctly characterized.',
    },
    section: {
      type: ['string', 'null'],
      description: "Where this appears, e.g. 'Section 8.2'; null if not identifiable.",
    },
    excerpt: {
      type: 'string',
      description: 'The relevant text copied VERBATIM from the contract (max 50 words).',
    },
    explanation: {
      type: 'string',
      description: "Plain-English explanation of why this is or isn't risky.",
    },
    recommendation: { type: 'string', description: 'A concrete, plain-English suggested action.' },
  };
  if (includeRedlines) {
    clauseProps.suggested_redline = {
      type: ['string', 'null'],
      description:
        'Proposed replacement/added contract language to reduce this risk; null if not applicable.',
    };
  }

  const playbookProps = {
    rule: { type: 'string', description: "The caller's policy position, restated concisely." },
    status: { type: 'string', enum: ['meets', 'violates', 'not_addressed'] },
    excerpt: {
      type: ['string', 'null'],
      description: 'Verbatim contract text relevant to this rule; null if not_addressed.',
    },
    explanation: { type: 'string' },
    recommendation: { type: 'string' },
  };
  if (includeRedlines) {
    playbookProps.suggested_redline = {
      type: ['string', 'null'],
      description: "Proposed language to satisfy this position; null if it already 'meets'.",
    };
  }

  const properties = {
    contract_type: {
      type: 'string',
      description: "The contract type, e.g. 'Master Services Agreement', 'NDA'.",
    },
    party_side: {
      type: 'string',
      description: "The perspective the analysis is written from, e.g. 'Client (receiving party)'.",
    },
    overall_risk_level: { type: 'string', enum: RISK_ENUM },
    overall_summary: {
      type: 'string',
      description: "2-3 sentence plain-English summary of the contract's main risk exposure.",
    },
    clauses: {
      type: 'array',
      description: 'Notable or risky clauses found in the contract.',
      items: strObj(clauseProps),
    },
    missing_protections: {
      type: 'array',
      description: 'Standard protections that appear to be absent for this type of contract.',
      items: strObj({
        clause_type: { type: 'string' },
        explanation: { type: 'string' },
        recommendation: { type: 'string' },
      }),
    },
    key_dates: {
      type: 'array',
      description: 'Dates and deadlines a party must track (renewals, notice windows, payments).',
      items: strObj({
        event: { type: 'string', description: 'What happens on/by this date.' },
        date: {
          type: ['string', 'null'],
          description: 'ISO 8601 date (YYYY-MM-DD) if determinable from the contract, else null.',
        },
        timing: {
          type: 'string',
          description: "When it occurs, verbatim or described, e.g. '90 days before end of term'.",
        },
        type: {
          type: 'string',
          enum: [
            'effective_date',
            'expiration',
            'renewal',
            'notice_deadline',
            'payment',
            'termination',
            'milestone',
            'other',
          ],
        },
        excerpt: { type: 'string', description: 'Verbatim source text for this date.' },
      }),
    },
    obligations: {
      type: 'array',
      description: 'Ongoing duties each party takes on under the contract.',
      items: strObj({
        party: { type: 'string', description: 'Who is obligated.' },
        obligation: { type: 'string', description: 'What they must do.' },
        timing: { type: 'string', description: 'When or under what trigger it applies.' },
        excerpt: { type: 'string', description: 'Verbatim source text for this obligation.' },
      }),
    },
  };

  if (hasPlaybook) {
    properties.playbook_findings = {
      type: 'array',
      description: 'Per-rule evaluation of the contract against the provided playbook.',
      items: strObj(playbookProps),
    };
  }

  return strObj(properties);
}

module.exports = { buildOutputJsonSchema };
