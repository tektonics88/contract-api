#!/usr/bin/env node
'use strict';

/**
 * End-to-end smoke test for the Contract Review API.
 *
 * Exercises the whole flow against a RUNNING server:
 *   1. GET  /health
 *   2. POST /analyze with no API key      -> expect 401 (when auth is on)
 *   3. POST /analyze with raw text (JSON)  -> expect 200 + structured result
 *   4. POST /analyze with a PDF upload     -> expect 200 + structured result
 *
 * Configuration (env vars):
 *   API_BASE_URL   base URL of the server (default http://localhost:3000)
 *   API_KEY        your API key. If set, requests are authenticated and the
 *                  401 check runs. If unset, assumes DISABLE_AUTH=true dev mode.
 *
 * Usage:
 *   node scripts/test-analyze.js
 *   API_KEY=sk_... node scripts/test-analyze.js
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const PDF_PATH = path.join(__dirname, '..', 'samples', 'sample-contract.pdf');
const TXT_PATH = path.join(__dirname, '..', 'samples', 'sample-contract.txt');

let failures = 0;
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

function authHeaders(extra = {}) {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}`, ...extra } : { ...extra };
}

function summarizeResult(result) {
  if (!result || typeof result !== 'object') {
    fail('response missing "result" object');
    return;
  }
  const { overall_risk, flagged_clauses, missing_protections } = result;
  if (['low', 'medium', 'high'].includes(overall_risk)) {
    pass(`overall_risk = "${overall_risk}"`);
  } else {
    fail(`overall_risk invalid: ${JSON.stringify(overall_risk)}`);
  }
  if (Array.isArray(flagged_clauses) && flagged_clauses.length > 0) {
    pass(`${flagged_clauses.length} flagged clause(s)`);
    console.log(
      flagged_clauses
        .slice(0, 6)
        .map((c) => `      - [${c.risk_level}] ${c.clause_name}`)
        .join('\n')
    );
  } else {
    fail('flagged_clauses missing or empty');
  }
  if (Array.isArray(missing_protections)) {
    pass(`${missing_protections.length} missing protection(s) noted`);
  } else {
    fail('missing_protections missing');
  }
}

async function testHealth() {
  console.log('\n[1] GET /health');
  try {
    const r = await fetch(`${BASE}/health`);
    const body = await r.json();
    if (r.status === 200 && body.status === 'ok') pass('server is healthy');
    else fail(`unexpected: HTTP ${r.status} ${JSON.stringify(body)}`);
  } catch (err) {
    fail(`could not reach server at ${BASE} — is it running? (${err.message})`);
    process.exit(1);
  }
}

async function testNoAuth() {
  console.log('\n[2] POST /analyze with no API key');
  if (!API_KEY) {
    console.log('  (skipped: no API_KEY set — assuming DISABLE_AUTH dev mode)');
    return;
  }
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'test' }),
  });
  if (r.status === 401) pass('rejected with 401 as expected');
  else fail(`expected 401, got ${r.status}`);
}

async function testText() {
  console.log('\n[3] POST /analyze with raw text (JSON)');
  const contract = fs.readFileSync(TXT_PATH, 'utf8');
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text: contract }),
  });
  const body = await r.json();
  if (r.status !== 200) {
    fail(`expected 200, got ${r.status}: ${JSON.stringify(body)}`);
    return;
  }
  pass(`HTTP 200 (source=${body.source}, chars=${body.characters_analyzed})`);
  summarizeResult(body.result);
}

async function testPdf() {
  console.log('\n[4] POST /analyze with PDF upload');
  const buf = fs.readFileSync(PDF_PATH);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'application/pdf' }), 'sample-contract.pdf');
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const body = await r.json();
  if (r.status !== 200) {
    fail(`expected 200, got ${r.status}: ${JSON.stringify(body)}`);
    return;
  }
  pass(`HTTP 200 (source=${body.source}, chars=${body.characters_analyzed})`);
  summarizeResult(body.result);
}

async function main() {
  console.log(`Contract Review API — end-to-end test`);
  console.log(`Target: ${BASE}   Auth: ${API_KEY ? 'on (API_KEY set)' : 'off (no API_KEY)'}`);

  await testHealth();
  await testNoAuth();
  await testText();
  await testPdf();

  console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
