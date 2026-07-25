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

test('buildAnalysisPrompt injects the contract text and core instructions', () => {
  const p = buildAnalysisPrompt('UNIQUE_CONTRACT_MARKER', {});
  assert.ok(p.includes('UNIQUE_CONTRACT_MARKER'));
  assert.match(p, /RISK CLAUSES/);
  assert.match(p, /MISSING PROTECTIONS/);
  assert.match(p, /VERBATIM/);
});

test('buildAnalysisPrompt instructs obligations and key-date extraction', () => {
  const p = buildAnalysisPrompt('C', {});
  assert.match(p, /KEY DATES/);
  assert.match(p, /OBLIGATIONS/);
});

test('buildAnalysisPrompt: playbook block only appears when a playbook is given', () => {
  assert.ok(!buildAnalysisPrompt('C', {}).includes('playbook_findings'));
  const withPb = buildAnalysisPrompt('C', { playbook: '- No uncapped liability' });
  assert.ok(withPb.includes('playbook_findings'));
  assert.ok(withPb.includes('No uncapped liability'));
});

test('buildAnalysisPrompt: redline instruction only when requested', () => {
  assert.ok(!buildAnalysisPrompt('C', {}).includes('suggested_redline'));
  assert.ok(buildAnalysisPrompt('C', { includeRedlines: true }).includes('suggested_redline'));
});

test('buildAnalysisPrompt: contract_type and party_side steer the framing', () => {
  assert.ok(buildAnalysisPrompt('C', { contractType: 'NDA' }).includes('The contract type is: NDA'));
  assert.ok(buildAnalysisPrompt('C', {}).includes('Determine the contract type'));
  assert.ok(buildAnalysisPrompt('C', { partySide: 'Disclosing Party' }).includes('Disclosing Party'));
});
