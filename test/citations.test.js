'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findExcerptLocation, anchorAnalysis } = require('../src/services/citations');

const TEXT = 'Section 1. The Provider may terminate this Agreement at any time.';

test('findExcerptLocation: exact match returns correct offsets', () => {
  const loc = findExcerptLocation(TEXT, 'may terminate this Agreement');
  assert.ok(loc);
  assert.equal(TEXT.slice(loc.char_start, loc.char_end), 'may terminate this Agreement');
});

test('findExcerptLocation: whitespace-insensitive match', () => {
  const loc = findExcerptLocation(TEXT, 'may   terminate\nthis Agreement');
  assert.ok(loc, 'should match despite differing whitespace');
  assert.equal(TEXT.slice(loc.char_start, loc.char_end), 'may terminate this Agreement');
});

test('findExcerptLocation: excerpt not present returns null', () => {
  assert.equal(findExcerptLocation(TEXT, 'unlimited free support forever'), null);
});

test('findExcerptLocation: handles empty/invalid input', () => {
  assert.equal(findExcerptLocation(TEXT, ''), null);
  assert.equal(findExcerptLocation(TEXT, '   '), null);
  assert.equal(findExcerptLocation(null, 'x'), null);
  assert.equal(findExcerptLocation(TEXT, null), null);
});

test('findExcerptLocation: excerpt with regex metacharacters matches literally', () => {
  const text = 'Fees are $1,500.00 (net 30) per month.';
  const loc = findExcerptLocation(text, '$1,500.00 (net 30)');
  assert.ok(loc);
  assert.equal(text.slice(loc.char_start, loc.char_end), '$1,500.00 (net 30)');
});

test('anchorAnalysis: verifies excerpts and builds an accurate summary', () => {
  const analysis = {
    clauses: [
      { clause_type: 'Termination', excerpt: 'may terminate this Agreement' }, // verifiable
      { clause_type: 'Fabricated', excerpt: 'unlimited free support forever' }, // not present
    ],
    playbook_findings: [
      { rule: 'r1', status: 'meets', excerpt: 'The Provider' }, // verifiable
      { rule: 'r2', status: 'not_addressed', excerpt: null }, // skipped
    ],
  };

  anchorAnalysis(analysis, TEXT);

  assert.equal(analysis.clauses[0].excerpt_verified, true);
  assert.ok(analysis.clauses[0].location);
  assert.equal(analysis.clauses[1].excerpt_verified, false);
  assert.equal(analysis.clauses[1].location, null);

  assert.equal(analysis.playbook_findings[0].excerpt_verified, true);
  // null-excerpt finding is left untouched (no verification fields added)
  assert.equal(analysis.playbook_findings[1].excerpt_verified, undefined);

  assert.deepEqual(analysis.citation_summary, {
    total_excerpts: 3,
    verified: 2,
    unverified: 1,
  });
});

test('anchorAnalysis: also anchors key_dates and obligations excerpts', () => {
  const analysis = {
    key_dates: [{ event: 'Renewal', excerpt: 'The Provider' }], // verifiable
    obligations: [{ party: 'Client', excerpt: 'nonexistent duty text' }], // not present
  };
  anchorAnalysis(analysis, TEXT);
  assert.equal(analysis.key_dates[0].excerpt_verified, true);
  assert.ok(analysis.key_dates[0].location);
  assert.equal(analysis.obligations[0].excerpt_verified, false);
  assert.deepEqual(analysis.citation_summary, { total_excerpts: 2, verified: 1, unverified: 1 });
});

test('anchorAnalysis: tolerates missing arrays and non-objects', () => {
  const empty = anchorAnalysis({}, TEXT);
  assert.deepEqual(empty.citation_summary, { total_excerpts: 0, verified: 0, unverified: 0 });
  // must not throw on a null analysis
  assert.doesNotThrow(() => anchorAnalysis(null, TEXT));
});
