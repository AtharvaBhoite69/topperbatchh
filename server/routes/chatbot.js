// =============================================================================
// TopperBatch - AI Chatbot & RAG Routes
// =============================================================================

const express = require('express');
const router = express.Router();

const { getDb } = require('../database/db');
const { generateId } = require('../utils/helpers');
const { authenticate, requireApproved } = require('../middleware/auth');
const { generateAnswer } = require('../services/gemini');
const { searchRelevantChunks } = require('../services/rag');

// Authenticated & approved students/admins only
router.use(authenticate, requireApproved);

/**
 * GET /api/chatbot/conversations
 * List user's conversations
 */
router.get('/conversations', (req, res, next) => {
  try {
    const db = getDb();
    const conversations = db.prepare(`
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
router.post('/conversations', (req, res, next) => {
  try {
    const { title, document_id } = req.body;
    const db = getDb();
    const convId = generateId();

    let docTitle = null;
    if (document_id) {
      const doc = db.prepare('SELECT title FROM documents WHERE id = ?').get(document_id);
      if (doc) docTitle = doc.title;
    }

    const defaultTitle = docTitle ? `Discussion: ${docTitle}` : 'New AI Session';

    db.prepare(`
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
router.get('/conversations/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const conv = db.prepare(`
      SELECT c.*, d.title as document_title, d.original_name as document_filename
      FROM chat_conversations c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE c.id = ? AND c.user_id = ?
    `).get(id, req.user.id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(id);

    // Parse sources JSON
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
 * Send message, run RAG pipeline, and generate Gemini response
 */
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, document_id } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const db = getDb();
    const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const activeDocId = document_id || conv.document_id;

    // Save user message
    const userMsgId = generateId();
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run(userMsgId, id, content.trim());

    // Update conversation timestamp
    db.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(id);

    // Retrieve previous messages for chat context (last 6)
    const historyRows = db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE conversation_id = ? AND id != ?
      ORDER BY created_at DESC
      LIMIT 6
    `).all(id, userMsgId).reverse();

    // RAG Search for relevant chunks
    let relevantChunks = [];
    let contextText = '';
    let sources = [];

    if (activeDocId) {
      try {
        relevantChunks = await searchRelevantChunks(content.trim(), activeDocId, 5);
        if (relevantChunks.length > 0) {
          const docInfo = db.prepare('SELECT title, original_name FROM documents WHERE id = ?').get(activeDocId);
          const docName = docInfo ? (docInfo.title || docInfo.original_name) : 'Selected PDF';

          contextText = relevantChunks
            .map((chunk, idx) => `[Source ${idx + 1}: ${docName}, Page ${chunk.page_number || 'N/A'}]\n${chunk.content}`)
            .join('\n\n---\n\n');

          sources = relevantChunks.map((chunk) => ({
            document_id: activeDocId,
            document_name: docName,
            page_number: chunk.page_number || 1,
            snippet: (chunk.content || '').slice(0, 160) + '...',
          }));
        }
      } catch (ragErr) {
        console.warn('RAG search warning:', ragErr.message);
      }
    }

    // Call Gemini AI
    let aiResponseText = '';
    try {
      aiResponseText = await generateAnswer(contextText, content.trim(), historyRows);
    } catch (aiErr) {
      console.error('Gemini call error:', aiErr.message);
      aiResponseText =
        'Sorry, I could not generate a response right now. Please verify that the GEMINI_API_KEY is configured properly in the server environment.';
    }

    // Save assistant response
    const assistantMsgId = generateId();
    db.prepare(`
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
 * DELETE /api/chatbot/conversations/:id
 */
router.delete('/conversations/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?').run(id, req.user.id);
    return res.status(200).json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

