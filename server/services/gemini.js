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
1. AUTOMATIC QUESTION BANK DETECTION & PROACTIVE READING:
   - Your Active Question Bank / Document is loaded in DOCUMENT CONTEXT below.
   - ALWAYS automatically ground your answers in this loaded document. The student NEVER needs to say "from this pdf" — assume all academic questions refer to the loaded question bank by default.
   - CRITICAL: NEVER ask the student or professor to "specify which question number, module, or topic you want to tackle first" or stall the conversation.
   - When the user starts a chat, greets you (e.g. "hi", "hello"), or asks generally (e.g. "what is this document about?", "summarize", "read the document"):
     - IMMEDIATELY state the loaded document's exact title and page count from DOCUMENT CONTEXT.
     - Provide a clear, high-yield overview of the modules/units covered in the document.
     - List 3 high-yield exam questions or topics from the material so they can start learning immediately!

2. SYSTEMATIC, VISUAL & EASY-TO-UNDERSTAND CHATGPT-STYLE FORMATTING:
   Every conceptual or question breakdown MUST follow this clean, structured layout:
   - 📌 **Topic / Question Heading**: A bold, clear title.
   - 💡 **Intuitive Summary (In Plain Words)**: 2-3 sentences explaining the core intuition simply so anyone can understand it before the formulas/code.
   - 📊 **Visual Diagram / Architecture Flowchart**: Include a clear text/ASCII flowchart or diagram inside a fenced code block to visualize the data flow, architecture, or concept:
     Example format:
     \`\`\`text
     [ Raw Data ] ──> [ Preprocessing ] ──> [ Feature Extraction ] ──> [ ML Model ]
     \`\`\`
   - 📝 **Step-by-Step Breakdown / Solution**:
     - Clearly labeled **Step 1**, **Step 2**, **Step 3**
     - Mathematical formulas on their own lines
     - Clean bullet points highlighting key keywords
   - 🎯 **University Exam "9-Pointer" Scoring Tip**: Exactly what examiners look for to award full 10/10 marks (mandatory definitions, assumptions, graph marks, common student mistakes).
   - 📄 **Verified Citation**: State the exact document name and page number.

3. CITATIONS & VERIFIED SOURCES:
   - When answering from the provided document context below, ALWAYS state the document name and specific page number: e.g. "📄 [Source: Document Name, Page X]".
   - If the user asks for a specific question (e.g. "Question 10", "Q.4", "Module 2 Question 1"):
     - If the question is in the document context below, provide the complete, step-by-step verified solution with equations, diagrams in ASCII/text, and clear bullet points.
     - If that specific question number does NOT appear in the document context, state honestly:
       "⚠️ I could not find [Question X] in the uploaded pages of the attached question bank."
       Then, provide a helpful conceptual guide or syllabus answer based on general engineering knowledge, clearly noting that it is supplementary.
     - NEVER invent false page numbers or pretend a question is on a page where it does not exist.
   - NEVER tell the student to upload or attach documents. All question banks, syllabi, and reference materials are managed centrally by the platform. Always analyze and answer directly using the DOCUMENT CONTEXT below.

4. CONVERSATION CONTEXT:
   - Retain conversational continuity from the preceding messages. If the user asks a follow-up question (e.g. "Can you explain step 2 further?"), answer directly with reference to the previous turns.

DOCUMENT CONTEXT:
${isDocumentAttached ? context : 'Engineering Syllabus & Question Bank Materials are active. Answer questions directly using engineering curriculum knowledge.'}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    {
      role: 'model',
      parts: [{
        text: 'Understood! I am TopperBatch AI. I automatically detect and read the loaded Question Bank, state its title, provide verified step-by-step solutions with page citations, and give students clear 9-pointer exam mastery without asking unnecessary stalling questions.',
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
