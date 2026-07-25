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
const DOCX_PATH = path.join(__dirname, '..', 'samples', 'sample-contract.docx');
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
  const { overall_risk_level, clauses, missing_protections } = result;
  if (['low', 'medium', 'high'].includes(overall_risk_level)) {
    pass(`overall_risk_level = "${overall_risk_level}"`);
  } else {
    fail(`overall_risk_level invalid: ${JSON.stringify(overall_risk_level)}`);
  }
  if (Array.isArray(clauses) && clauses.length > 0) {
    pass(`${clauses.length} clause(s) flagged`);
    console.log(
      clauses
        .slice(0, 6)
        .map(
          (c) =>
            `      - [${c.risk_level}/conf:${c.confidence}] ${c.clause_type}` +
            `${c.section ? ` (${c.section})` : ''} ${c.excerpt_verified ? '✓cited' : '⚠unverified'}` +
            `${c.suggested_redline ? ' ✎redline' : ''}`
        )
        .join('\n')
    );
  } else {
    fail('clauses missing or empty');
  }
  if (Array.isArray(missing_protections)) {
    pass(`${missing_protections.length} missing protection(s) noted`);
  } else {
    fail('missing_protections missing');
  }
  if (Array.isArray(clauses)) {
    const withRedline = clauses.filter((c) => c.suggested_redline).length;
    if (withRedline > 0) pass(`${withRedline} clause(s) include a suggested_redline`);
  }
  if (result.citation_summary) {
    const cs = result.citation_summary;
    pass(`citations: ${cs.verified}/${cs.total_excerpts} excerpts verified against source`);
  }
  if (Array.isArray(result.playbook_findings)) {
    pass(`${result.playbook_findings.length} playbook finding(s)`);
    console.log(
      result.playbook_findings
        .slice(0, 6)
        .map((p) => `      - [${p.status}] ${p.rule}`)
        .join('\n')
    );
  }
  if (result.contract_type) pass(`detected/echoed contract_type = "${result.contract_type}"`);
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
  console.log('\n[3] POST /analyze with raw text + options (party_side, contract_type, playbook)');
  const contract = fs.readFileSync(TXT_PATH, 'utf8');
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text: contract,
      contract_type: 'Master Services Agreement',
      party_side: 'Client (the party being asked to sign)',
      include_redlines: true,
      playbook: [
        'Liability must be capped at no more than 12 months of fees.',
        'We require at least 30 days notice for termination for convenience.',
        'Auto-renewal is only acceptable with 60 days or less notice to cancel.',
      ],
    }),
  });
  const body = await r.json();
  if (r.status !== 200) {
    fail(`expected 200, got ${r.status}: ${JSON.stringify(body)}`);
    return;
  }
  pass(`HTTP 200 (source=${body.source}, chars=${body.characters_analyzed})`);
  if (body.options_applied) {
    pass(`options_applied: ${JSON.stringify(body.options_applied)}`);
  }
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

async function testDocx() {
  console.log('\n[5] POST /analyze with DOCX upload');
  const buf = fs.readFileSync(DOCX_PATH);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    'sample-contract.docx'
  );
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
  await testDocx();

  console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
