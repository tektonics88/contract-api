'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildOutputJsonSchema } = require('../src/services/schema');

function assertStrictObject(node) {
  assert.equal(node.type, 'object');
  assert.equal(node.additionalProperties, false);
  // strict mode: every declared property is required
  assert.deepEqual(new Set(node.required), new Set(Object.keys(node.properties)));
}

test('base schema is a strict object with the core sections', () => {
  const s = buildOutputJsonSchema({});
  assertStrictObject(s);
  for (const key of [
    'contract_type',
    'party_side',
    'overall_risk_level',
    'overall_summary',
    'clauses',
    'missing_protections',
    'key_dates',
    'obligations',
  ]) {
    assert.ok(s.properties[key], `expected top-level "${key}"`);
  }
});

test('key_dates and obligations items are strict objects with excerpts', () => {
  const s = buildOutputJsonSchema({});
  assertStrictObject(s.properties.key_dates.items);
  assertStrictObject(s.properties.obligations.items);
  assert.ok(s.properties.key_dates.items.properties.excerpt);
  assert.ok(s.properties.obligations.items.properties.excerpt);
  // key_dates.type is a constrained enum
  assert.ok(Array.isArray(s.properties.key_dates.items.properties.type.enum));
});

test('risk/confidence use the low|medium|high enum', () => {
  const clause = buildOutputJsonSchema({}).properties.clauses.items;
  assert.deepEqual(clause.properties.risk_level.enum, ['low', 'medium', 'high']);
  assert.deepEqual(clause.properties.confidence.enum, ['low', 'medium', 'high']);
});

test('playbook_findings only present when a playbook is given', () => {
  assert.equal(buildOutputJsonSchema({}).properties.playbook_findings, undefined);
  const withPb = buildOutputJsonSchema({ playbook: '- rule' });
  assert.ok(withPb.properties.playbook_findings);
  assertStrictObject(withPb.properties.playbook_findings.items);
  assert.deepEqual(withPb.properties.playbook_findings.items.properties.status.enum, [
    'meets',
    'violates',
    'not_addressed',
  ]);
});

test('suggested_redline only present when redlines requested', () => {
  assert.equal(
    buildOutputJsonSchema({}).properties.clauses.items.properties.suggested_redline,
    undefined
  );
  const withRl = buildOutputJsonSchema({ includeRedlines: true, playbook: '- r' });
  assert.ok(withRl.properties.clauses.items.properties.suggested_redline);
  assert.ok(withRl.properties.playbook_findings.items.properties.suggested_redline);
});

test('nullable fields use a nullable type (strict mode keeps them required)', () => {
  const clause = buildOutputJsonSchema({}).properties.clauses.items;
  assert.deepEqual(clause.properties.section.type, ['string', 'null']);
  assert.ok(clause.required.includes('section'));
});
