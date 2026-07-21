#!/usr/bin/env node
'use strict';

/**
 * Generates samples/sample-contract.pdf from samples/sample-contract.txt.
 *
 * Dependency-free: writes a minimal, valid multi-page PDF (Helvetica text)
 * with a correct cross-reference table, so the repo can ship a sample PDF
 * for end-to-end testing without any PDF library.
 *
 * Usage: node scripts/make-sample-pdf.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'samples', 'sample-contract.txt');
const OUT = path.join(__dirname, '..', 'samples', 'sample-contract.pdf');

const FONT_SIZE = 9;
const LEADING = 12;
const MAX_CHARS = 95; // wrap width
const LINES_PER_PAGE = 58;
const START_Y = 780;
const LEFT_X = 40;

function escapePdfText(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Wrap a single source line to MAX_CHARS, preserving word boundaries.
function wrapLine(line) {
  if (line.length <= MAX_CHARS) return [line];
  const words = line.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    if ((cur + (cur ? ' ' : '') + w).length > MAX_CHARS) {
      if (cur) out.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function buildContentStream(lines) {
  let s = `BT\n/F1 ${FONT_SIZE} Tf\n${LEFT_X} ${START_Y} Td\n${LEADING} TL\n`;
  for (const line of lines) {
    s += `(${escapePdfText(line)}) Tj\nT*\n`;
  }
  s += 'ET';
  return s;
}

function main() {
  const raw = fs.readFileSync(SRC, 'utf8');
  const wrapped = raw.split('\n').flatMap(wrapLine);

  // Paginate.
  const pages = [];
  for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) {
    pages.push(wrapped.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  // Object numbering: 1=Catalog, 2=Pages, 3=Font, then per page: pageObj, contentObj.
  const objects = {}; // number -> string body (without "N 0 obj"/"endobj")
  const pageObjNums = [];
  let next = 4;
  for (let p = 0; p < pages.length; p++) {
    const pageNum = next++;
    const contentNum = next++;
    pageObjNums.push(pageNum);

    const content = buildContentStream(pages[p]);
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentNum] =
      `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`;
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] =
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] ` +
    `/Count ${pageObjNums.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const totalObjects = next - 1;

  // Serialize with byte-accurate xref offsets.
  const chunks = [];
  let offset = 0;
  const offsets = {};
  const push = (str) => {
    const buf = Buffer.from(str, 'utf8');
    chunks.push(buf);
    offset += buf.length;
  };

  push('%PDF-1.4\n');
  for (let n = 1; n <= totalObjects; n++) {
    offsets[n] = offset;
    push(`${n} 0 obj\n${objects[n]}\nendobj\n`);
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f\r\n`;
  for (let n = 1; n <= totalObjects; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n\r\n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  fs.writeFileSync(OUT, Buffer.concat(chunks));
  console.log(`Wrote ${OUT} (${pages.length} page(s), ${wrapped.length} lines)`);
}

main();
