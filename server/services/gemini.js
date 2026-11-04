// =============================================================================
// TopperBatch - Gemini AI Service
// =============================================================================

const env = require('../config/env');

let genAI = null;
let model = null;
let embeddingModel = null;

/**
 * Initialize the Gemini AI client.
 */
function initGemini() {
  if (!env.GEMINI_API_KEY) {
    console.warn('⚠️  Gemini API key not set. AI features will use fallback mode.');
    return false;
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    console.log('✅ Gemini AI initialized.');
    return true;
  } catch (err) {
    console.error('Failed to initialize Gemini AI:', err.message);
    return false;
  }
}

/**
 * Generate an answer using Gemini AI with context and chat history.
 * @param {string} context - Document context chunks
 * @param {string} question - User's question
 * @param {Array<{role: string, content: string}>} chatHistory - Previous messages
 * @returns {Promise<string>} Generated answer
 */
async function generateAnswer(context, question, chatHistory = []) {
  if (!model) {
    const initialized = initGemini();
    if (!initialized) {
      return 'AI features are not available right now. The Gemini API key is not configured. Please ask an admin to set it up. In the meantime, I can show you the relevant document sections based on keyword matching.';
    }
  }

  try {
    const systemPrompt = `You are TopperBatch AI, a helpful academic assistant for the TopperBatch student community platform (tagline: "ISS SEM, 9 POINTER FIX!").

INSTRUCTIONS:
- Answer questions based ONLY on the provided document context below.
- If the answer is not in the context, say so clearly: "I couldn't find this information in the provided documents."
- Always cite the source document name and page number when available.
- Be concise, clear, and educational in your responses.
- Use bullet points or numbered lists for better readability when appropriate.
- If the question is ambiguous, ask for clarification.

DOCUMENT CONTEXT:
${context || 'No document context available.'}`;

    // Build conversation history
    const contents = [];

    // Add system instruction as the first user message
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'I understand. I will answer based only on the provided document context and cite sources. How can I help you?' }],
    });

    // Add chat history
    for (const msg of chatHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add the current question
    contents.push({
      role: 'user',
      parts: [{ text: question }],
    });

    const result = await model.generateContent({ contents });
    const response = result.response;
    return response.text();
  } catch (err) {
    console.error('Gemini AI error:', err);
    if (err.message && err.message.includes('API key')) {
      return 'AI service configuration error. Please check the API key.';
    }
    return 'I encountered an error processing your question. Please try again.';
  }
}

/**
 * Generate an embedding vector for text.
 * @param {string} text - Text to embed
 * @returns {Promise<number[]|null>} Embedding vector or null
 */
async function generateEmbedding(text) {
  if (!embeddingModel) {
    const initialized = initGemini();
    if (!initialized) return null;
  }

  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error('Embedding generation error:', err);
    return null;
  }
}

/**
 * Check if Gemini AI is available.
 * @returns {boolean}
 */
function isAvailable() {
  if (model) return true;
  return initGemini();
}

module.exports = {
  generateAnswer,
  generateEmbedding,
  isAvailable,
  initGemini,
};
