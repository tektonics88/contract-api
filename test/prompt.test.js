'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalysisPrompt, RISK_CATEGORIES, DISCLAIMER } = require('../src/services/prompt');

test('RISK_CATEGORIES includes the restored categories', () => {
  assert.ok(RISK_CATEGORIES.length >= 12);
  assert.ok(RISK_CATEGORIES.some((c) => c.includes('Assignment / change of control')));
  assert.ok(RISK_CATEGORIES.some((c) => c.includes('Governing law')));
});

test('DISCLAIMER makes clear it is not legal advice', () => {
  assert.match(DISCLAIMER, /not legal advice/i);
});

test('buildAnalysisPrompt injects the contract text and core schema fields', () => {
  const p = buildAnalysisPrompt('UNIQUE_CONTRACT_MARKER', {});
  assert.ok(p.includes('UNIQUE_CONTRACT_MARKER'));
  for (const field of [
    'clauses',
    'clause_type',
    'overall_risk_level',
    'overall_summary',
    'confidence',
    'excerpt',
    'recommendation',
    'missing_protections',
  ]) {
    assert.ok(p.includes(field), `expected schema to mention "${field}"`);
  }
});

test('buildAnalysisPrompt: playbook_findings only appears when a playbook is given', () => {
  assert.ok(!buildAnalysisPrompt('C', {}).includes('playbook_findings'));
  const withPb = buildAnalysisPrompt('C', { playbook: '- No uncapped liability' });
  assert.ok(withPb.includes('playbook_findings'));
  assert.ok(withPb.includes('No uncapped liability'));
});

test('buildAnalysisPrompt: suggested_redline only appears when redlines requested', () => {
  assert.ok(!buildAnalysisPrompt('C', {}).includes('suggested_redline'));
  assert.ok(buildAnalysisPrompt('C', { includeRedlines: true }).includes('suggested_redline'));
});

test('buildAnalysisPrompt: contract_type and party_side steer the framing', () => {
  const withType = buildAnalysisPrompt('C', { contractType: 'NDA' });
  assert.ok(withType.includes('The contract type is: NDA'));

  const withoutType = buildAnalysisPrompt('C', {});
  assert.ok(withoutType.includes('determine the contract type'));

  const withParty = buildAnalysisPrompt('C', { partySide: 'Disclosing Party' });
  assert.ok(withParty.includes('Disclosing Party'));
});
