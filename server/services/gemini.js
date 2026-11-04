// =============================================================================
// TopperBatch - Gemini AI Service
// =============================================================================

const env = require('../config/env');

let genAI = null;
let model = null;
let embeddingModel = null;

// Supported active Gemini models in order of preference
const MODEL_CANDIDATES = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

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
    model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    console.log('✅ Gemini AI initialized with gemini-3.8-flash and gemini-embedding-001.');
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
  if (!genAI) {
    const initialized = initGemini();
    if (!initialized) {
      return 'AI features are not available right now. The Gemini API key is not configured. Please ask an admin to set it up.';
    }
  }

  const systemPrompt = `You are TopperBatch AI, a helpful academic assistant for the TopperBatch student community platform (tagline: "ISS SEM, 9 POINTER FIX!").

INSTRUCTIONS:
- Answer questions thoroughly and accurately to help students prepare for their semester examinations.
- If document context is provided below, prioritize it and cite the document name or page number.
- If no document context is provided or if the topic is general, use your extensive academic knowledge to explain concepts step-by-step with formulas, bullet points, and exam examples.
- Be concise, clear, and educational in your responses.
- Use bullet points or numbered lists for readability.

DOCUMENT CONTEXT:
${context || 'No specific document context attached. Answer using broad engineering & academic syllabus knowledge.'}`;

  // Build conversation history
  const contents = [];

  // Add system instruction as the initial user/model exchange
  contents.push({
    role: 'user',
    parts: [{ text: systemPrompt }],
  });
  contents.push({
    role: 'model',
    parts: [{ text: 'Understood! I am TopperBatch AI, ready to help you score that 9-pointer with verified exam solutions and step-by-step concept explanations. How can I assist you?' }],
  });

  // Add past conversation turns
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  // Add current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: question }],
  });

  // Try candidate models with fallback
  let lastError = null;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const activeModel = genAI.getGenerativeModel({ model: modelName });
      const result = await activeModel.generateContent({ contents });
      const response = result.response;
      return response.text();
    } catch (err) {
      console.warn(`Gemini model ${modelName} warning:`, err.message);
      lastError = err;
    }
  }

  console.error('All Gemini model candidates failed:', lastError);
  if (lastError?.message && lastError.message.includes('API key')) {
    return 'Gemini API key error. Please verify that your GEMINI_API_KEY is active and valid.';
  }
  return 'I encountered a temporary service issue generating a response. Please try asking again in a moment.';
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
