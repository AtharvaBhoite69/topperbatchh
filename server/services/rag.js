// =============================================================================
// TopperBatch - High-Accuracy RAG (Retrieval-Augmented Generation) Pipeline
// =============================================================================

const { getDb } = require('../database/db');
const { generateEmbedding } = require('./gemini');
const { generateId } = require('../utils/helpers');

// In-memory query embedding cache to avoid redundant API calls
const queryEmbeddingCache = new Map();
const MAX_CACHE_SIZE = 150;

/**
 * Split text into semantic chunks with paragraph, question, and sentence boundary awareness.
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Target chunk size in characters (default 1200)
 * @param {number} overlap - Overlap in characters (default 150)
 * @returns {string[]} Array of text chunks
 */
function splitIntoChunks(text, chunkSize = 1200, overlap = 150) {
  if (!text || text.trim().length === 0) return [];

  const cleanedText = text.trim();
  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }

  const chunks = [];
  let start = 0;

  // Question boundary markers to keep question prompts and answers unified
  const questionPattern = /(?:^|\n)(?:Q\.?\s*\d+|Question\s*\d+|[0-9]{1,2}[\.\)])\s+/i;

  while (start < cleanedText.length) {
    let end = start + chunkSize;

    if (end < cleanedText.length) {
      // Look for the best natural boundary between 50% and 100% of chunkSize
      const searchWindow = cleanedText.substring(start + Math.floor(chunkSize * 0.5), end);

      // 1. Check for double line breaks (paragraphs)
      const paragraphBreak = searchWindow.lastIndexOf('\n\n');
      if (paragraphBreak !== -1) {
        end = start + Math.floor(chunkSize * 0.5) + paragraphBreak + 2;
      } else {
        // 2. Check for sentence endings (.!?)
        const lastPeriod = Math.max(
          searchWindow.lastIndexOf('. '),
          searchWindow.lastIndexOf('.\n'),
          searchWindow.lastIndexOf('? '),
          searchWindow.lastIndexOf('!\n')
        );
        if (lastPeriod !== -1) {
          end = start + Math.floor(chunkSize * 0.5) + lastPeriod + 1;
        } else {
          // 3. Check for single newline
          const lastNewline = searchWindow.lastIndexOf('\n');
          if (lastNewline !== -1) {
            end = start + Math.floor(chunkSize * 0.5) + lastNewline + 1;
          }
        }
      }
    }

    const chunk = cleanedText.substring(start, Math.min(end, cleanedText.length)).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= cleanedText.length) break;
  }

  return chunks;
}

/**
 * Index a document: extract pages, create chunks, generate embeddings.
 * @param {string} documentId - The document ID to index
 * @param {boolean} force - Force re-index even if already marked indexed
 */
async function indexDocument(documentId, force = false) {
  const db = getDb();

  const document = await db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  if (document.is_indexed && !force) {
    const existingChunks = await db.prepare('SELECT COUNT(*) as c FROM document_chunks WHERE document_id = ?').get(documentId);
    if (existingChunks && existingChunks.c > 0) {
      console.log(`ℹ️ Document ${documentId} is already indexed (${existingChunks.c} chunks).`);
      return;
    }
  }

  // Get document pages
  const pages = await db.prepare(
    'SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number ASC'
  ).all(documentId);

  if (pages.length === 0) {
    console.warn(`No pages found for document ${documentId}`);
    return;
  }

  // Delete existing chunks if re-indexing
  await db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(documentId);

  const insertChunk = db.prepare(`
    INSERT INTO document_chunks (id, document_id, page_number, chunk_index, content, embedding)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const allChunks = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    if (!page.content || page.content.trim().length === 0) continue;

    const chunks = splitIntoChunks(page.content, 1200, 150);

    for (const chunkText of chunks) {
      allChunks.push({
        id: generateId(),
        document_id: documentId,
        page_number: page.page_number,
        chunk_index: globalChunkIndex++,
        content: chunkText,
      });
    }
  }

  // Generate embeddings with batch fallback
  console.log(`⏳ Generating embeddings for ${allChunks.length} chunks of document "${document.title}"...`);
  
  for (const chunk of allChunks) {
    let embeddingStr = null;
    try {
      const embedding = await generateEmbedding(chunk.content.slice(0, 800));
      if (embedding) {
        embeddingStr = JSON.stringify(embedding);
      }
    } catch (err) {
      // Embedding failure is non-fatal; hybrid keyword search will handle it
    }
    chunk.embedding = embeddingStr;
  }

  // Insert all chunks
  for (const c of allChunks) {
    await insertChunk.run(c.id, c.document_id, c.page_number, c.chunk_index, c.content, c.embedding);
  }

  // Mark document as indexed
  await db.prepare('UPDATE documents SET is_indexed = 1 WHERE id = ?').run(documentId);

  console.log(`✅ Indexed document "${document.title}": ${allChunks.length} chunks with page references.`);
}

/**
 * Search for relevant chunks using hybrid semantic embeddings + keyword matching.
 * Scopes to a specific document or prioritizes documents mentioned in query.
 * 
 * @param {string} query - Search query
 * @param {string|null} documentId - Document ID to scope search
 * @param {number} topK - Number of top results to return (default 5)
 * @returns {Promise<Array<{content: string, page_number: number, score: number, document_id: string}>>}
 */
async function searchRelevantChunks(query, documentId = null, topK = 5) {
  if (!query || !query.trim()) return [];

  const db = getDb();
  let targetDocId = documentId;

  // If no document selected, check if user mentioned a document title or topic in query
  if (!targetDocId) {
    const allDocs = await db.prepare('SELECT id, title, topic FROM documents').all();
    for (const doc of allDocs) {
      const titleTerms = (doc.title || '').toLowerCase().split(/[\s_\-\.]+/).filter((t) => t.length > 3);
      if (titleTerms.some((term) => query.toLowerCase().includes(term))) {
        targetDocId = doc.id;
        break;
      }
    }
  }

  // Fetch candidate chunks from DB
  let chunks;
  if (targetDocId) {
    chunks = await db.prepare(
      'SELECT id, document_id, page_number, chunk_index, content, embedding FROM document_chunks WHERE document_id = ?'
    ).all(targetDocId);
  } else {
    // Top 300 most recent chunks if global
    chunks = await db.prepare(
      'SELECT id, document_id, page_number, chunk_index, content, embedding FROM document_chunks ORDER BY created_at DESC LIMIT 300'
    ).all();
  }

  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Check for specific Question number request (e.g. "Question 10", "Q.10", "Q 10", "Question 5")
  const questionNumberMatch = query.match(/(?:question|q\.?)\s*([0-9]{1,3})/i);
  const targetQuestionNum = questionNumberMatch ? questionNumberMatch[1] : null;

  // Obtain query embedding with cache
  let queryEmbedding = null;
  const cacheKey = query.trim().toLowerCase();
  if (queryEmbeddingCache.has(cacheKey)) {
    queryEmbedding = queryEmbeddingCache.get(cacheKey);
  } else {
    try {
      queryEmbedding = await generateEmbedding(query.trim());
      if (queryEmbedding) {
        if (queryEmbeddingCache.size >= MAX_CACHE_SIZE) {
          const firstKey = queryEmbeddingCache.keys().next().value;
          queryEmbeddingCache.delete(firstKey);
        }
        queryEmbeddingCache.set(cacheKey, queryEmbedding);
      }
    } catch (_) {}
  }

  // Extract query keywords (terms of length >= 2 to support things like 'AI', 'OS', 'IP', 'Q1')
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const scoredChunks = chunks.map((chunk) => {
    let semanticScore = 0;
    let keywordScore = 0;
    const contentLower = chunk.content.toLowerCase();

    // 1. Semantic Embedding Similarity
    if (queryEmbedding && chunk.embedding) {
      try {
        const chunkVector = JSON.parse(chunk.embedding);
        semanticScore = cosineSimilarity(queryEmbedding, chunkVector);
      } catch (_) {}
    }

    // 2. Keyword Frequency & Exact Match Scoring
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        keywordScore += 1;
        // Whole word bonus
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(chunk.content)) {
          keywordScore += 1.5;
        }
      }
    }

    // Phrase match bonus
    if (contentLower.includes(query.toLowerCase().trim())) {
      keywordScore += 10;
    }

    // 3. Question Number Specific Boost
    if (targetQuestionNum) {
      const qPatterns = [
        new RegExp(`q\\.?\\s*${targetQuestionNum}\\b`, 'i'),
        new RegExp(`question\\s*${targetQuestionNum}\\b`, 'i'),
        new RegExp(`\\b${targetQuestionNum}[\\.\\)]\\s+`, 'i'),
      ];
      if (qPatterns.some((pattern) => pattern.test(chunk.content))) {
        keywordScore += 25; // Massive boost to land the exact question
      }
    }

    // Normalize keyword score between 0 and 1
    const normalizedKeyword = Math.min(1, keywordScore / (queryTerms.length * 2 + 5));

    // Combined score: when embedding exists, 60% semantic + 40% keyword; otherwise pure keyword
    const finalScore = queryEmbedding && chunk.embedding
      ? semanticScore * 0.6 + normalizedKeyword * 0.4
      : normalizedKeyword;

    return {
      id: chunk.id,
      content: chunk.content,
      page_number: chunk.page_number || 1,
      document_id: chunk.document_id,
      score: finalScore,
    };
  });

  const filtered = scoredChunks
    .filter((c) => c.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fallback: If no chunks scored > 0.05 (e.g. user asked generic "read document", "summarize", or "overview"),
  // return the first chunks of the targeted document or available documents so context is never empty!
  if (filtered.length === 0 && chunks.length > 0) {
    return chunks.slice(0, topK).map((c) => ({
      id: c.id,
      content: c.content,
      page_number: c.page_number || 1,
      document_id: c.document_id,
      score: 0.2,
    }));
  }

  return filtered;
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
