// =============================================================================
// TopperBatch - PDF Processing Service
// =============================================================================

const fs = require('fs');
const path = require('path');

/**
 * Extract text from a PDF file.
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<{text: string, pageCount: number, pages: Array<{pageNumber: number, content: string}>}>}
 */
async function extractText(filePath) {
  // Dynamic import for pdf-parse (CommonJS compatibility)
  const pdfParse = require('pdf-parse');

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);

  try {
    const data = await pdfParse(dataBuffer);

    // pdf-parse doesn't provide per-page text out of the box
    // We split by form-feed characters or by using heuristics
    const fullText = data.text || '';
    const pageCount = data.numpages || 1;

    // Split text into pages using form-feed or heuristic
    const rawPages = fullText.split(/\f/);
    const pages = [];

    for (let i = 0; i < pageCount; i++) {
      pages.push({
        pageNumber: i + 1,
        content: rawPages[i] ? rawPages[i].trim() : '',
      });
    }

    // If splitting didn't work well, put all text in page 1
    if (pages.length === 0 || (pages.length === 1 && !pages[0].content && fullText.trim())) {
      pages.length = 0;
      pages.push({
        pageNumber: 1,
        content: fullText.trim(),
      });
    }

    return {
      text: fullText,
      pageCount,
      pages,
    };
  } catch (err) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
}

/**
 * Get text from a specific page of a PDF.
 * @param {string} filePath - Absolute path to the PDF file
 * @param {number} pageNumber - Page number (1-indexed)
 * @returns {Promise<string>} Page text content
 */
async function getPageText(filePath, pageNumber) {
  const result = await extractText(filePath);
  const page = result.pages.find((p) => p.pageNumber === pageNumber);
  return page ? page.content : '';
}

module.exports = {
  extractText,
  getPageText,
};
