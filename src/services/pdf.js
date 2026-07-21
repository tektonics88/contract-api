'use strict';

const pdfParse = require('pdf-parse');

/**
 * Extracts plain text from a PDF buffer.
 * Throws a 400-style error if the buffer isn't a parseable PDF or is empty.
 *
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<string>} extracted text
 */
async function extractTextFromPdf(buffer) {
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    const e = new Error(`Failed to parse PDF: ${err.message}`);
    e.status = 400;
    e.publicMessage = 'Uploaded file could not be parsed as a PDF.';
    throw e;
  }

  const text = (data.text || '').trim();
  if (!text) {
    const e = new Error('PDF contained no extractable text');
    e.status = 400;
    e.publicMessage =
      'No text could be extracted from the PDF (it may be scanned images — OCR is not supported yet).';
    throw e;
  }
  return text;
}

module.exports = { extractTextFromPdf };
