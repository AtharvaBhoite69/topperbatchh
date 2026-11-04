// =============================================================================
// TopperBatch - RAG (Retrieval-Augmented Generation) Pipeline
// =============================================================================

const { getDb } = require('../database/db');
const { generateEmbedding } = require('./gemini');
const { generateId } = require('../utils/helpers');

/**
 * Split text into overlapping chunks.
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Target chunk size in characters
 * @param {number} overlap - Overlap in characters
 * @returns {string[]} Array of text chunks
 */
function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.substring(start, Math.min(end, text.length)).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Index a document: extract pages, create chunks, generate embeddings.
 * @param {string} documentId - The document ID to index
 */
async function indexDocument(documentId) {
  const db = getDb();

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Get document pages
  const pages = db.prepare(
    'SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number'
  ).all(documentId);

  if (pages.length === 0) {
    console.warn(`No pages found for document ${documentId}`);
    return;
  }

  // Delete existing chunks
  db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(documentId);

  // Process each page
  const insertChunk = db.prepare(
    'INSERT INTO document_chunks (id, document_id, page_number, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((chunks) => {
    for (const chunk of chunks) {
      insertChunk.run(
        chunk.id,
        chunk.document_id,
        chunk.page_number,
        chunk.chunk_index,
        chunk.content,
        chunk.embedding
      );
    }
  });

  const allChunks = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    if (!page.content || page.content.trim().length === 0) continue;

    const chunks = splitIntoChunks(page.content);

    for (const chunkText of chunks) {
      // Generate embedding if Gemini is available
      let embeddingStr = null;
      try {
        const embedding = await generateEmbedding(chunkText);
        if (embedding) {
          embeddingStr = JSON.stringify(embedding);
        }
      } catch (err) {
        // Continue without embedding
        console.warn('Failed to generate embedding for chunk:', err.message);
      }

      allChunks.push({
        id: generateId(),
        document_id: documentId,
        page_number: page.page_number,
        chunk_index: globalChunkIndex++,
        content: chunkText,
        embedding: embeddingStr,
      });
    }
  }

  // Insert all chunks in a transaction
  insertMany(allChunks);

  // Mark document as indexed
  db.prepare('UPDATE documents SET is_indexed = 1 WHERE id = ?').run(documentId);

  console.log(`📄 Indexed document ${documentId}: ${allChunks.length} chunks created.`);
}

/**
 * Search for relevant chunks using cosine similarity or keyword fallback.
 * @param {string} query - Search query
 * @param {string} documentId - Optional document ID to scope search
 * @param {number} topK - Number of top results to return
 * @returns {Promise<Array<{content: string, page_number: number, score: number, document_id: string}>>}
 */
async function searchRelevantChunks(query, documentId = null, topK = 5) {
  const db = getDb();

  // Try embedding-based search first
  const queryEmbedding = await generateEmbedding(query);

  let chunks;
  if (documentId) {
    chunks = db.prepare(
      'SELECT * FROM document_chunks WHERE document_id = ?'
    ).all(documentId);
  } else {
    chunks = db.prepare('SELECT * FROM document_chunks').all();
  }

  if (chunks.length === 0) return [];

  if (queryEmbedding) {
    // Cosine similarity search
    const scored = chunks
      .filter((chunk) => chunk.embedding)
      .map((chunk) => {
        const chunkEmbedding = JSON.parse(chunk.embedding);
        const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
        return {
          content: chunk.content,
          page_number: chunk.page_number,
          document_id: chunk.document_id,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (scored.length > 0) return scored;
  }

  // Fallback: keyword-based search
  return keywordSearch(chunks, query, topK);
}

/**
 * Keyword-based search fallback when embeddings are not available.
 * @param {Array} chunks - Document chunks
 * @param {string} query - Search query
 * @param {number} topK - Number of top results
 * @returns {Array} Ranked chunks
 */
function keywordSearch(chunks, query, topK) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  if (queryTerms.length === 0) return chunks.slice(0, topK).map((c) => ({
    content: c.content,
    page_number: c.page_number,
    document_id: c.document_id,
    score: 0,
  }));

  const scored = chunks.map((chunk) => {
    const content = chunk.content.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      // Count occurrences
      const matches = content.split(term).length - 1;
      score += matches;

      // Bonus for exact phrase match
      if (content.includes(query.toLowerCase())) {
        score += 5;
      }
    }

    return {
      content: chunk.content,
      page_number: chunk.page_number,
      document_id: chunk.document_id,
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Cosine similarity (0 to 1)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

module.exports = {
  indexDocument,
  searchRelevantChunks,
  cosineSimilarity,
  splitIntoChunks,
};
