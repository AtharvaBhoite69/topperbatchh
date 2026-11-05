// =============================================================================
// TopperBatch - AI Chatbot & High-Performance RAG Routes (with Streaming)
// Production-Ready: Supabase PostgreSQL & Gemini 3.5 Flash Lite
// =============================================================================

const express = require('express');
const router = express.Router();

const { getDb } = require('../database/db');
const { generateId } = require('../utils/helpers');
const { authenticate, requireApproved } = require('../middleware/auth');
const { generateAnswer, generateAnswerStream } = require('../services/gemini');
const { searchRelevantChunks } = require('../services/rag');

// Authenticated & approved students/admins only
router.use(authenticate, requireApproved);

/**
 * Helper to prepare RAG context and verified citations
 */
async function buildRAGContext(db, query, documentId) {
  let relevantChunks = [];
  let contextText = '';
  let sources = [];

  try {
    relevantChunks = await searchRelevantChunks(query, documentId, 6);

    // If search didn't yield chunks, fallback to top chunks from available documents
    if (!relevantChunks || relevantChunks.length === 0) {
      if (documentId) {
        relevantChunks = await db.prepare(
          'SELECT id, document_id, page_number, chunk_index, content FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT 6'
        ).all(documentId);
      } else {
        relevantChunks = await db.prepare(
          'SELECT id, document_id, page_number, chunk_index, content FROM document_chunks ORDER BY created_at DESC LIMIT 6'
        ).all();
      }
    }

    if (relevantChunks && relevantChunks.length > 0) {
      // Collect document details for each chunk
      const docCache = new Map();

      for (const chunk of relevantChunks) {
        if (!docCache.has(chunk.document_id)) {
          const doc = await db.prepare('SELECT title, original_name FROM documents WHERE id = ?').get(chunk.document_id);
          docCache.set(chunk.document_id, doc ? (doc.title || doc.original_name) : 'Question Bank PDF');
        }
      }

      // Add Active Document banner so Gemini immediately detects and announces the loaded question bank
      let activeDocBanner = '';
      if (documentId) {
        const activeDoc = await db.prepare('SELECT title, original_name, page_count FROM documents WHERE id = ?').get(documentId);
        if (activeDoc) {
          activeDocBanner = `=== ACTIVE LOADED DOCUMENT: "${activeDoc.title || activeDoc.original_name}" (${activeDoc.page_count || 1} Pages) ===\n\n`;
        }
      } else {
        const topDoc = await db.prepare('SELECT title, original_name, page_count FROM documents WHERE is_visible = 1 ORDER BY created_at DESC LIMIT 1').get();
        if (topDoc) {
          activeDocBanner = `=== ACTIVE LOADED QUESTION BANK: "${topDoc.title || topDoc.original_name}" (${topDoc.page_count || 1} Pages) ===\n\n`;
        }
      }

      contextText = activeDocBanner + relevantChunks
        .map((chunk, idx) => {
          const docName = docCache.get(chunk.document_id) || 'Uploaded PDF';
          return `[Source ${idx + 1}: ${docName}, Page ${chunk.page_number || 1}]\n${chunk.content}`;
        })
        .join('\n\n---\n\n');

      sources = relevantChunks.map((chunk) => ({
        document_id: chunk.document_id,
        document_name: docCache.get(chunk.document_id) || 'Uploaded PDF',
        page_number: chunk.page_number || 1,
        snippet: (chunk.content || '').replace(/\s+/g, ' ').slice(0, 160) + '...',
      }));
    }
  } catch (ragErr) {
    console.warn('RAG search warning:', ragErr.message);
  }

  return { contextText, sources };
}

/**
 * GET /api/chatbot/conversations
 * List user's conversations
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const db = getDb();
    const conversations = await db.prepare(`
      SELECT c.*, d.title as document_title, d.original_name as document_filename
      FROM chat_conversations c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.user.id);

    return res.status(200).json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chatbot/conversations
 * Start a new chat session
 */
router.post('/conversations', async (req, res, next) => {
  try {
    let { title, document_id } = req.body;
    const db = getDb();
    const convId = generateId();

    // Automatically bind to the active Question Bank if not specified
    if (!document_id) {
      const defaultDoc = await db.prepare(
        'SELECT id, title FROM documents WHERE is_visible = 1 ORDER BY created_at DESC LIMIT 1'
      ).get();
      if (defaultDoc) {
        document_id = defaultDoc.id;
      }
    }

    let docTitle = null;
    if (document_id) {
      const doc = await db.prepare('SELECT title FROM documents WHERE id = ?').get(document_id);
      if (doc) docTitle = doc.title;
    }

    const defaultTitle = docTitle ? `Discussion: ${docTitle}` : 'New AI Session';

    await db.prepare(`
      INSERT INTO chat_conversations (id, user_id, title, document_id)
      VALUES (?, ?, ?, ?)
    `).run(convId, req.user.id, (title || defaultTitle).slice(0, 100), document_id || null);

    return res.status(201).json({
      success: true,
      conversation: {
        id: convId,
        title: title || defaultTitle,
        document_id: document_id || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chatbot/conversations/:id
 * Get full conversation history
 */
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const conv = await db.prepare(`
      SELECT c.*, d.title as document_title, d.original_name as document_filename
      FROM chat_conversations c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.id = ? AND c.user_id = ?
    `).get(id, req.user.id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await db.prepare(`
      SELECT * FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(id);

    const parsedMessages = messages.map((m) => ({
      ...m,
      sources: m.sources ? JSON.parse(m.sources) : [],
    }));

    return res.status(200).json({
      success: true,
      conversation: conv,
      messages: parsedMessages,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chatbot/conversations/:id/messages
 * Send message and generate standard JSON response
 */
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, document_id } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const db = getDb();
    const conv = await db.prepare('SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    let activeDocId = document_id || conv.document_id;
    if (!activeDocId) {
      const topDoc = await db.prepare('SELECT id FROM documents WHERE is_visible = 1 ORDER BY created_at DESC LIMIT 1').get();
      if (topDoc) activeDocId = topDoc.id;
    }

    // Save user message
    const userMsgId = generateId();
    await db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run(userMsgId, id, content.trim());

    await db.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(id);

    // Context from previous turns
    const historyRows = (await db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE conversation_id = ? AND id != ?
      ORDER BY created_at DESC
      LIMIT 6
    `).all(id, userMsgId)).reverse();

    // RAG Search
    const { contextText, sources } = await buildRAGContext(db, content.trim(), activeDocId);

    // Call Gemini
    const aiResponseText = await generateAnswer(contextText, content.trim(), historyRows, req.user.role);

    // Save assistant message
    const assistantMsgId = generateId();
    await db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, sources)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(assistantMsgId, id, aiResponseText, JSON.stringify(sources));

    return res.status(200).json({
      success: true,
      message: {
        id: assistantMsgId,
        conversation_id: id,
        role: 'assistant',
        content: aiResponseText,
        sources,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chatbot/conversations/:id/messages/stream
 * High-performance Server-Sent Events (SSE) streaming endpoint
 */
router.post('/conversations/:id/messages/stream', async (req, res) => {
  const { id } = req.params;
  const { content, document_id } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  const db = getDb();
  const conv = await db.prepare('SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  let activeDocId = document_id || conv.document_id;
  if (!activeDocId) {
    const topDoc = await db.prepare('SELECT id FROM documents WHERE is_visible = 1 ORDER BY created_at DESC LIMIT 1').get();
    if (topDoc) activeDocId = topDoc.id;
  }

  // Save user message
  const userMsgId = generateId();
  await db.prepare(`
    INSERT INTO chat_messages (id, conversation_id, role, content)
    VALUES (?, ?, 'user', ?)
  `).run(userMsgId, id, content.trim());

  await db.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(id);

  // Retrieve context
  const historyRows = (await db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE conversation_id = ? AND id != ?
    ORDER BY created_at DESC
    LIMIT 6
  `).all(id, userMsgId)).reverse();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Perform RAG Search
  const { contextText, sources } = await buildRAGContext(db, content.trim(), activeDocId);

  // Send sources immediately to client
  res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

  let completeAssistantResponse = '';
  const assistantMsgId = generateId();

  try {
    for await (const token of generateAnswerStream(contextText, content.trim(), historyRows, req.user.role)) {
      completeAssistantResponse += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }

    // Save complete message into DB
    await db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, sources)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(assistantMsgId, id, completeAssistantResponse, JSON.stringify(sources));

    res.write(`data: ${JSON.stringify({
      type: 'done',
      message: {
        id: assistantMsgId,
        conversation_id: id,
        role: 'assistant',
        content: completeAssistantResponse,
        sources,
        created_at: new Date().toISOString(),
      },
    })}\n\n`);
  } catch (streamErr) {
    console.error('SSE Stream error:', streamErr.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr.message })}\n\n`);
  } finally {
    res.end();
  }
});

/**
 * DELETE /api/chatbot/conversations/:id
 */
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.prepare('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?').run(id, req.user.id);
    return res.status(200).json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
