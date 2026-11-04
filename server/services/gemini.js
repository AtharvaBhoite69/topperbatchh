// =============================================================================
// TopperBatch - Google Gemini AI Service (Chat, RAG & Streaming)
// =============================================================================

const env = require('../config/env');

let genAI = null;
let model = null;
let embeddingModel = null;

// Supported active Gemini models in order of priority (starting with stable, high-throughput flash-lite models)
const MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
];

/**
 * Initialize the Gemini AI client.
 */
function initGemini() {
  if (!env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY is not set. AI features will run in offline fallback mode.');
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
 * Build structured system prompt and contents payload for Gemini.
 */
function buildGeminiPayload(context, question, chatHistory = [], role = 'student') {
  const isDocumentAttached = context && context.trim().length > 0;

  const systemPrompt = `You are TopperBatch AI, the premier academic study companion and syllabus mentor for the TopperBatch engineering community platform (motto: "ISS SEM, 9 POINTER FIX!").
Your user is a verified ${role === 'admin' ? 'Platform Administrator / Professor' : 'Engineering Student'}.

ACADEMIC DIRECTIVES:
1. CITATIONS & VERIFIED SOURCES:
   - When answering from the provided document context below, ALWAYS state the document name and specific page number: e.g. "📄 [Source: Document Name, Page X]".
   - If the user asks for a specific question (e.g. "Question 10", "Q.4", "Module 2 Question 1"):
     - If the question is in the document context below, provide the complete, step-by-step verified solution with equations, diagrams in ASCII/text, and clear bullet points.
     - If that specific question number does NOT appear in the document context, state honestly:
       "⚠️ I could not find [Question X] in the uploaded pages of the attached question bank."
       Then, provide a helpful conceptual guide or syllabus answer based on general engineering knowledge, clearly noting that it is supplementary.
     - NEVER invent false page numbers or pretend a question is on a page where it does not exist.

2. CLARITY & EXPLANATION STYLE:
   - Explain difficult engineering concepts in simple, intuitive language using real-world analogies.
   - For numericals, derivations, or algorithms, explain step-by-step with clear formulas and intermediate steps.
   - When asked to summarize, provide a high-yield summary highlighting definitions, key formulas, and exam tips.
   - When asked for practice questions, provide 3 to 5 realistic semester exam-level MCQs or descriptive questions with hints.

3. CONVERSATION CONTEXT:
   - Retain conversational continuity from the preceding messages. If the user asks a follow-up question (e.g. "Can you explain step 2 further?"), answer directly with reference to the previous turns.

DOCUMENT CONTEXT:
${isDocumentAttached ? context : 'No specific document is currently attached. Answer using broad engineering curriculum knowledge.'}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    {
      role: 'model',
      parts: [{
        text: 'Understood! I am TopperBatch AI, ready to help with verified question bank solutions, exact page citations, step-by-step engineering explanations, and 9-pointer exam mastery. What topic or question are we tackling?',
      }],
    },
  ];

  // Include recent chat history (compacted)
  const recentHistory = chatHistory.slice(-6);
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  // Current prompt
  contents.push({
    role: 'user',
    parts: [{ text: question }],
  });

  return contents;
}

/**
 * Generate a complete answer using Gemini with candidate fallback.
 * 
 * @param {string} context - Document context retrieved via RAG
 * @param {string} question - User question
 * @param {Array} chatHistory - Array of past message objects { role, content }
 * @param {string} role - 'student' or 'admin'
 * @returns {Promise<string>} Generated answer
 */
async function generateAnswer(context, question, chatHistory = [], role = 'student') {
  if (!genAI) {
    const initialized = initGemini();
    if (!initialized) {
      return 'AI features are currently unavailable. The GEMINI_API_KEY is not configured on the server. Please check environment variables.';
    }
  }

  const contents = buildGeminiPayload(context, question, chatHistory, role);

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

  console.error('All Gemini model candidates failed in generateAnswer:', lastError?.message);
  if (lastError?.message && lastError.message.includes('API key')) {
    return 'Gemini API key error. Please verify that your GEMINI_API_KEY is active and valid in your server configuration.';
  }
  return 'I encountered a temporary service issue connecting to the AI provider. Please try asking again in a moment.';
}

/**
 * Stream an answer token-by-token using Gemini with candidate fallback.
 * Async generator that yields text chunks.
 * 
 * @param {string} context
 * @param {string} question
 * @param {Array} chatHistory
 * @param {string} role
 * @returns {AsyncGenerator<string>} Yields text tokens
 */
async function* generateAnswerStream(context, question, chatHistory = [], role = 'student') {
  if (!genAI) {
    const initialized = initGemini();
    if (!initialized) {
      yield 'AI features are currently unavailable. The GEMINI_API_KEY is not configured on the server.';
      return;
    }
  }

  const contents = buildGeminiPayload(context, question, chatHistory, role);

  let streamSuccess = false;
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const activeModel = genAI.getGenerativeModel({ model: modelName });
      const result = await activeModel.generateContentStream({ contents });
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
      streamSuccess = true;
      break;
    } catch (err) {
      console.warn(`Gemini stream model ${modelName} warning:`, err.message);
      lastError = err;
    }
  }

  if (!streamSuccess) {
    console.error('All Gemini model streaming candidates failed:', lastError?.message);
    yield 'I encountered a temporary service issue generating a response. Please try asking again in a moment.';
  }
}

/**
 * Generate an embedding vector for text using gemini-embedding-001.
 * @param {string} text - Text to embed
 * @returns {Promise<number[]|null>} Embedding vector or null
 */
async function generateEmbedding(text) {
  if (!genAI) {
    const initialized = initGemini();
    if (!initialized) return null;
  }

  try {
    const activeEmbeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await activeEmbeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (err) {
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
  generateAnswerStream,
  generateEmbedding,
  isAvailable,
  initGemini,
};
