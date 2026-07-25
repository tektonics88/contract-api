'use strict';

const mammoth = require('mammoth');

/**
 * Extracts plain text from a Word .docx buffer.
 * Throws a 400-style error if the buffer isn't a parseable .docx or is empty.
 *
 * @param {Buffer} buffer - raw .docx bytes
 * @returns {Promise<string>} extracted text
 */
async function extractTextFromDocx(buffer) {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    const e = new Error(`Failed to parse DOCX: ${err.message}`);
    e.status = 400;
    e.publicMessage = 'Uploaded file could not be parsed as a Word (.docx) document.';
    throw e;
  }

  const text = (result.value || '').trim();
  if (!text) {
    const e = new Error('DOCX contained no extractable text');
    e.status = 400;
    e.publicMessage = 'No text could be extracted from the Word document.';
    throw e;
  }
  return text;
}

module.exports = { extractTextFromDocx };
