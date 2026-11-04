// =============================================================================
// TopperBatch - Enhanced PDF Processing Service
// =============================================================================

const fs = require('fs');
const path = require('path');

/**
 * Extract text from a PDF file preserving accurate per-page text content and line breaks.
 * Uses pdf-parse's pagerender hook to accurately capture each page separately.
 * 
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<{text: string, pageCount: number, pages: Array<{pageNumber: number, content: string}>}>}
 */
async function extractText(filePath) {
  const pdfParse = require('pdf-parse');

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);

  try {
    const rawPages = [];
    let currentPageIndex = 1;

    // Custom pagerender to capture exact text per page with natural linebreaks
    const renderPage = (pageData) => {
      const pageNum = currentPageIndex++;
      return pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      }).then((textContent) => {
        let lastY;
        let pageText = '';
        for (const item of textContent.items) {
          if (lastY === undefined || lastY === item.transform[5]) {
            pageText += (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n') ? ' ' : '') + item.str;
          } else {
            pageText += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        const trimmed = pageText.trim();
        rawPages.push({
          pageNumber: pageNum,
          content: trimmed,
        });

        return trimmed;
      });
    };

    const parsedData = await pdfParse(dataBuffer, {
      pagerender: renderPage,
    });

    const pageCount = parsedData.numpages || rawPages.length || 1;
    const fullText = rawPages.map((p) => p.content).filter(Boolean).join('\n\n') || parsedData.text || '';

    // If custom renderer did not produce pages (e.g. unexpected PDF format), fallback gracefully
    let finalPages = rawPages;
    if (finalPages.length === 0) {
      const formFeedSplit = fullText.split(/\f/).map((c) => c.trim()).filter(Boolean);
      if (formFeedSplit.length > 1) {
        finalPages = formFeedSplit.map((content, idx) => ({
          pageNumber: idx + 1,
          content,
        }));
      } else {
        finalPages = [{
          pageNumber: 1,
          content: fullText.trim(),
        }];
      }
    }

    return {
      text: fullText,
      pageCount,
      pages: finalPages,
    };
  } catch (err) {
    console.error('PDF parsing error:', err.message);
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
