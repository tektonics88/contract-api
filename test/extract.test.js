'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractTextFromPdf } = require('../src/services/pdf');
const { extractTextFromDocx } = require('../src/services/docx');

const SAMPLES = path.join(__dirname, '..', 'samples');

test('extractTextFromPdf: pulls text from the sample PDF', async () => {
  const buf = fs.readFileSync(path.join(SAMPLES, 'sample-contract.pdf'));
  const text = await extractTextFromPdf(buf);
  assert.ok(text.length > 500);
  assert.ok(text.includes('INDEMNIFICATION'));
  assert.ok(text.includes('NON-COMPETE'));
});

test('extractTextFromDocx: pulls text from the sample DOCX', async () => {
  const buf = fs.readFileSync(path.join(SAMPLES, 'sample-contract.docx'));
  const text = await extractTextFromDocx(buf);
  assert.ok(text.length > 500);
  assert.ok(text.includes('INDEMNIFICATION'));
  assert.ok(text.includes('NON-COMPETE'));
});

test('extractTextFromPdf: rejects a non-PDF buffer with a 400', async () => {
  await assert.rejects(
    () => extractTextFromPdf(Buffer.from('this is plainly not a pdf')),
    (err) => err.status === 400
  );
});

test('extractTextFromDocx: rejects a non-DOCX buffer with a 400', async () => {
  await assert.rejects(
    () => extractTextFromDocx(Buffer.from('this is plainly not a docx')),
    (err) => err.status === 400
  );
});
