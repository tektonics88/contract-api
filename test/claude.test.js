'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseJsonResponse } = require('../src/services/claude');

test('parseJsonResponse: parses clean JSON', () => {
  assert.deepEqual(parseJsonResponse('{"a":1,"b":"two"}'), { a: 1, b: 'two' });
});

test('parseJsonResponse: strips ```json fences', () => {
  const raw = '```json\n{"a":1}\n```';
  assert.deepEqual(parseJsonResponse(raw), { a: 1 });
});

test('parseJsonResponse: strips bare ``` fences', () => {
  assert.deepEqual(parseJsonResponse('```\n{"a":1}\n```'), { a: 1 });
});

test('parseJsonResponse: recovers JSON wrapped in stray prose', () => {
  const raw = 'Here is the analysis you asked for:\n{"a":1}\nHope that helps!';
  assert.deepEqual(parseJsonResponse(raw), { a: 1 });
});

test('parseJsonResponse: handles nested objects when recovering', () => {
  const raw = 'noise {"outer":{"inner":[1,2,3]}} trailing';
  assert.deepEqual(parseJsonResponse(raw), { outer: { inner: [1, 2, 3] } });
});

test('parseJsonResponse: throws on non-JSON', () => {
  assert.throws(() => parseJsonResponse('this is not json at all'));
});
