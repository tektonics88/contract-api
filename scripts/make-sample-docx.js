#!/usr/bin/env node
'use strict';

/**
 * Generates samples/sample-contract.docx from samples/sample-contract.txt.
 *
 * Builds a minimal, valid Office Open XML (.docx) package with JSZip. JSZip is
 * available transitively via the `mammoth` dependency used to parse DOCX
 * uploads, so no extra install is needed.
 *
 * Usage: node scripts/make-sample-docx.js
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const SRC = path.join(__dirname, '..', 'samples', 'sample-contract.txt');
const OUT = path.join(__dirname, '..', 'samples', 'sample-contract.docx');

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function buildDocumentXml(lines) {
  const paragraphs = lines
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paragraphs}
  </w:body>
</w:document>`;
}

async function main() {
  const raw = fs.readFileSync(SRC, 'utf8');
  const lines = raw.split('\n');

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels').file('.rels', RELS);
  zip.folder('word').file('document.xml', buildDocumentXml(lines));

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(OUT, buffer);
  console.log(`Wrote ${OUT} (${lines.length} paragraphs, ${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
