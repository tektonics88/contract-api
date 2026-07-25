'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlaybook, parseOptions } = require('../src/services/options');

test('normalizePlaybook: null/empty inputs return null', () => {
  assert.equal(normalizePlaybook(undefined), null);
  assert.equal(normalizePlaybook(''), null);
  assert.equal(normalizePlaybook('   '), null);
  assert.equal(normalizePlaybook([]), null);
});

test('normalizePlaybook: free-text string passes through trimmed', () => {
  assert.equal(normalizePlaybook('  No uncapped liability.  '), 'No uncapped liability.');
});

test('normalizePlaybook: array of strings becomes a bulleted block', () => {
  assert.equal(normalizePlaybook(['Rule A', 'Rule B']), '- Rule A\n- Rule B');
});

test('normalizePlaybook: array of {rule} objects is supported', () => {
  assert.equal(normalizePlaybook([{ rule: 'Rule A' }, { rule: 'Rule B' }]), '- Rule A\n- Rule B');
});

test('normalizePlaybook: JSON-encoded array string (multipart) is parsed', () => {
  assert.equal(normalizePlaybook('["Rule A","Rule B"]'), '- Rule A\n- Rule B');
});

test('normalizePlaybook: malformed JSON array falls back to free text', () => {
  assert.equal(normalizePlaybook('[not valid json'), '[not valid json');
});

test('parseOptions: extracts all options from a JSON body', () => {
  const opts = parseOptions({
    body: {
      contract_type: '  MSA  ',
      party_side: 'Client',
      playbook: ['No uncapped liability'],
      include_redlines: true,
    },
  });
  assert.equal(opts.contractType, 'MSA');
  assert.equal(opts.partySide, 'Client');
  assert.equal(opts.playbook, '- No uncapped liability');
  assert.equal(opts.includeRedlines, true);
});

test('parseOptions: absent options are undefined / false', () => {
  const opts = parseOptions({ body: { text: 'hello' } });
  assert.equal(opts.contractType, undefined);
  assert.equal(opts.partySide, undefined);
  assert.equal(opts.playbook, undefined);
  assert.equal(opts.includeRedlines, false);
});

test('parseOptions: include_redlines accepts the string "true" (multipart)', () => {
  assert.equal(parseOptions({ body: { include_redlines: 'true' } }).includeRedlines, true);
  assert.equal(parseOptions({ body: { include_redlines: 'false' } }).includeRedlines, false);
  assert.equal(parseOptions({ body: { include_redlines: '1' } }).includeRedlines, false);
});

test('parseOptions: blank strings are treated as absent', () => {
  const opts = parseOptions({ body: { contract_type: '   ', party_side: '' } });
  assert.equal(opts.contractType, undefined);
  assert.equal(opts.partySide, undefined);
});

test('parseOptions: tolerates a missing body', () => {
  assert.doesNotThrow(() => parseOptions({}));
  assert.equal(parseOptions({}).includeRedlines, false);
});
