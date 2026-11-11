// =============================================================================
// TopperBatch - Admin AI PDF-to-MCQ Generator Service
// =============================================================================

const env = require('../config/env');
const { extractText } = require('./pdf');
const { generateId } = require('../utils/helpers');

let genAI = null;

function getGenAI() {
  if (!genAI && env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

// Supported active Gemini models in order of priority (starting with stable, high-throughput flash-lite models)
const MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
];

/**
 * Safely parse JSON returned by Gemini (handling potential markdown wrapping)
 */
function cleanAndParseJSON(rawText) {
  if (!rawText) return null;

  let cleaned = rawText.trim();
  // Strip ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt to extract json object / array substring
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (_) {}
    }
    console.error('Failed to parse Gemini JSON output:', err.message, '\nRaw:\n', rawText.slice(0, 300));
    return null;
  }
}

/**
 * Generate Multiple Choice Questions from an uploaded PDF.
 * 
 * @param {Object} options
 * @param {string} options.filePath - Path to the PDF file
 * @param {string} options.originalName - Original file name of the PDF
 * @param {number} [options.count=10] - Number of questions to generate
 * @param {string} [options.difficulty='mixed'] - 'easy' | 'medium' | 'hard' | 'mixed'
 * @param {string} [options.questionStyle='mixed'] - 'conceptual' | 'definition-based' | 'application-based' | 'mixed'
 * @param {string} [options.topic=''] - Specific topic or chapter (optional)
 * @param {string} [options.instructions=''] - Custom generation instructions (optional)
 * @returns {Promise<{questions: Array, summary: string, pageCount: number, insufficientContentReason: string|null}>}
 */
async function generateMCQsFromPDF({
  filePath,
  preExtractedPages = null,
  originalName,
  count = 10,
  difficulty = 'mixed',
  questionStyle = 'mixed',
  topic = '',
  instructions = '',
}) {
  const client = getGenAI();
  if (!client) {
    throw new Error('Gemini API is not configured. GEMINI_API_KEY missing from environment.');
  }

  // 1. Use pre-extracted DB pages if available, otherwise parse PDF file
  const extraction =
    Array.isArray(preExtractedPages) && preExtractedPages.length > 0
      ? {
          pages: preExtractedPages,
          pageCount: preExtractedPages.length,
          text: preExtractedPages.map((p) => p.content || '').join('\n'),
        }
      : await extractText(filePath);
  const totalPages = extraction.pageCount || extraction.pages.length || 1;

  if (!extraction.pages || extraction.pages.length === 0 || !extraction.text.trim()) {
    throw new Error('Could not extract readable text from the provided PDF. The file may be empty or image-only scanned without OCR.');
  }

  // 2. Prepare representative content scoped by topic or across pages
  let selectedPages = extraction.pages;
  if (topic && topic.trim()) {
    const topicLower = topic.toLowerCase();
    const matchingPages = extraction.pages.filter((p) => p.content.toLowerCase().includes(topicLower));
    if (matchingPages.length > 0) {
      selectedPages = matchingPages;
    }
  }

  // Build structured document excerpt with page boundaries
  // Limit total characters to stay well within Gemini fast processing budget while covering pages
  let combinedContext = '';
  for (const page of selectedPages) {
    if (page.content && page.content.trim()) {
      combinedContext += `\n\n--- [PAGE ${page.pageNumber} OF ${totalPages}] ---\n${page.content.slice(0, 3500)}`;
    }
    if (combinedContext.length > 35000) break; // generous ~8,000 words
  }

  const prompt = `You are a senior engineering professor creating real university-level Multiple Choice Questions (MCQs) from the provided PDF material.

SOURCE PDF: "${originalName}"
TOTAL PAGES: ${totalPages}
REQUESTED QUESTION COUNT: ${count}
REQUESTED DIFFICULTY: ${difficulty} (Easy, Medium, Hard, or Mixed)
QUESTION STYLE: ${questionStyle} (Conceptual, Definition-based, Application-based, or Mixed)
${topic ? `SPECIFIC TOPIC / MODULE: ${topic}` : ''}
${instructions ? `ADMINISTRATOR CUSTOM INSTRUCTIONS: ${instructions}` : ''}

CRITICAL CONTENT & QUESTION-BANK RULES:
1. TURN QUESTION BANKS & SYLLABI INTO REAL TECHNICAL MCQs (SOLVE THEM FIRST!):
   - Many uploaded PDFs are Question Banks (e.g. "Q1. Explain Backpropagation", "Q2. Compare TCP vs UDP") or Syllabus Module lists WITHOUT written answers inside the PDF.
   - When the PDF contains a question prompt or syllabus topic WITHOUT its solution:
     1) READ the question/topic carefully.
     2) SOLVE the question / recall the verified engineering concept yourself as a subject-matter expert.
     3) CREATE a challenging technical MCQ testing the core concept, formula, algorithm, architecture, or comparison of that answer!
   - When the PDF contains full study notes/derivations, base both the question and verified answer directly on those notes.
2. STRICTLY FORBIDDEN META-QUESTIONS (ZERO STUPID QUESTIONS):
   - NEVER ask about the PDF layout or numbering itself!
   - STRICTLY BANNED examples: "What is asked in Question 1?", "Which module contains X?", "How many marks is Q3?", "On which page is topic Y?", "What is the subject code?", "Who is the author of reference book 1?".
   - Every single MCQ must test genuine technical/subject understanding that a student needs to score 9+ CGPA in the exam!
3. OPTIONS STRUCTURE:
   - Every question must have EXACTLY 4 answer options: "A", "B", "C", and "D".
   - EXACTLY ONE option must be correct.
   - All 3 wrong options (distractors) must be realistic, plausible engineering concepts — never joke options or "All/None of the above" filler unless mathematically necessary.
4. DETAILED EXPLANATION:
   - Explain the engineering reasoning clearly so the student learns WHY the correct option is right and why the other options are wrong.
5. CITATION & PAGE REFERENCE:
   - Set "source_page" to the integer page number from [PAGE X] where that topic/question appears.
6. FORMAT:
   - Return ONLY a valid JSON object matching this schema EXACTLY:
{
  "summary": "Brief 1-sentence overview of the technical topics covered by these MCQs.",
  "insufficient_content_reason": null,
  "questions": [
    {
      "id": "q1",
      "question": "Clear technical engineering question testing the concept (never about PDF numbering/marks)?",
      "options": [
        { "label": "A", "text": "First technical option" },
        { "label": "B", "text": "Second technical option" },
        { "label": "C", "text": "Third technical option" },
        { "label": "D", "text": "Fourth technical option" }
      ],
      "correct_answer": "A",
      "explanation": "Clear technical explanation of the answer and why other options are incorrect.",
      "source_page": 2,
      "topic": "Specific engineering topic name",
      "difficulty": "medium"
    }
  ]
}

DOCUMENT PAGES EXCERPT:
${combinedContext}`;

  let parsed = null;
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const activeModel = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2, // low temperature for high fidelity to text
          responseMimeType: 'application/json',
        },
      });

      const response = await activeModel.generateContent(prompt);
      const text = response.response.text();
      parsed = cleanAndParseJSON(text);

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        break; // Successfully got valid questions
      }
    } catch (err) {
      console.warn(`MCQ Generator with model ${modelName} error:`, err.message);
      lastError = err;
    }
  }

  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error(lastError ? `AI MCQ generation failed: ${lastError.message}` : 'Failed to parse AI-generated questions into valid MCQ format.');
  }

  // Validate and sanitize every question
  const sanitizedQuestions = parsed.questions.map((q, idx) => {
    let rawOptions = Array.isArray(q.options) ? q.options : [];
    
    // Normalize options to array of 4 objects { label, text }
    const labels = ['A', 'B', 'C', 'D'];
    const options = labels.map((lbl, optIdx) => {
      const found = rawOptions.find((o) => (o.label || '').toUpperCase() === lbl) || rawOptions[optIdx];
      let optText = '';
      if (typeof found === 'string') {
        optText = found.replace(/^[A-D][\.\:\)\s]+/i, '').trim();
      } else if (found && typeof found.text === 'string') {
        optText = found.text.trim();
      }
      return {
        label: lbl,
        text: optText || `Option ${lbl}`,
      };
    });

    // Normalize correct_answer to 'A', 'B', 'C', or 'D'
    let correct = 'A';
    if (q.correct_answer && typeof q.correct_answer === 'string') {
      const char = q.correct_answer.trim().toUpperCase()[0];
      if (['A', 'B', 'C', 'D'].includes(char)) {
        correct = char;
      }
    } else if (typeof q.correct_index === 'number' && q.correct_index >= 0 && q.correct_index <= 3) {
      correct = labels[q.correct_index];
    }

    const pageNum = parseInt(q.source_page || q.page_number || 1, 10);

    return {
      id: generateId(),
      tempId: `gen_${idx + 1}_${Date.now()}`,
      question: (q.question || `Question ${idx + 1}`).trim(),
      options,
      correct_answer: correct,
      explanation: (q.explanation || 'Verified from course study material.').trim(),
      source_pdf: originalName,
      source_page: isNaN(pageNum) || pageNum < 1 ? 1 : pageNum,
      topic: (q.topic || topic || 'General Engineering').trim(),
      difficulty: ['easy', 'medium', 'hard'].includes((q.difficulty || '').toLowerCase())
        ? q.difficulty.toLowerCase()
        : 'medium',
      is_approved: false, // strictly false until admin explicitly reviews & approves
    };
  });

  return {
    questions: sanitizedQuestions,
    summary: parsed.summary || `Generated ${sanitizedQuestions.length} MCQs from "${originalName}".`,
    pageCount: totalPages,
    insufficientContentReason: parsed.insufficient_content_reason || null,
  };
}

/**
 * Regenerate a single question using Gemini
 */
async function regenerateSingleQuestion({
  pdfFilePath,
  preExtractedPages = null,
  originalName,
  pageNumber = 1,
  topic = '',
  difficulty = 'medium',
  questionStyle = 'mixed',
  existingQuestion = '',
  instructions = '',
}) {
  const client = getGenAI();
  if (!client) {
    throw new Error('Gemini API is not configured.');
  }

  // Get specific page text from pre-extracted DB pages or PDF file
  const extraction =
    Array.isArray(preExtractedPages) && preExtractedPages.length > 0
      ? {
          pages: preExtractedPages,
          text: preExtractedPages.map((p) => p.content || '').join('\n'),
        }
      : await extractText(pdfFilePath);
  const targetPage = extraction.pages.find((p) => p.pageNumber === parseInt(pageNumber, 10)) || extraction.pages[0];
  const pageText = targetPage ? targetPage.content : extraction.text.slice(0, 4000);

  const prompt = `You are a senior engineering professor creating a replacement Multiple Choice Question (MCQ) from page ${pageNumber} of "${originalName}".

RULES:
- If the page contains Question Bank prompts or syllabus topics without answers, read a topic/question on the page, solve the technical concept yourself, and write a real conceptual/technical MCQ testing that answer.
- NEVER ask meta-questions about PDF structure (like "What is in Question 1?", "How many marks?", "Which module?", or "Which textbook?").
- DO NOT repeat this existing question: "${existingQuestion}"

TARGET TOPIC: ${topic || 'General'}
TARGET DIFFICULTY: ${difficulty}
QUESTION STYLE: ${questionStyle}
${instructions ? `CUSTOM INSTRUCTIONS: ${instructions}` : ''}

PAGE TEXT CONTENT:
${pageText.slice(0, 4000)}

Return ONLY valid JSON matching this schema:
{
  "question": "Clear technical engineering question testing the concept?",
  "options": [
    { "label": "A", "text": "Option A" },
    { "label": "B", "text": "Option B" },
    { "label": "C", "text": "Option C" },
    { "label": "D", "text": "Option D" }
  ],
  "correct_answer": "A",
  "explanation": "Clear technical explanation of why this option is correct for page ${pageNumber}...",
  "source_page": ${pageNumber},
  "topic": "${topic || 'General'}",
  "difficulty": "${difficulty}"
}`;

  let parsed = null;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const activeModel = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const response = await activeModel.generateContent(prompt);
      parsed = cleanAndParseJSON(response.response.text());
      if (parsed && parsed.question && Array.isArray(parsed.options)) break;
    } catch (_) {}
  }

  if (!parsed || !parsed.question) {
    throw new Error('Could not regenerate question.');
  }

  const labels = ['A', 'B', 'C', 'D'];
  const options = labels.map((lbl, idx) => {
    const raw = Array.isArray(parsed.options) ? parsed.options[idx] : null;
    return {
      label: lbl,
      text: (raw && raw.text ? raw.text : `Alternative Option ${lbl}`).trim(),
    };
  });

  return {
    id: generateId(),
    question: parsed.question.trim(),
    options,
    correct_answer: ['A', 'B', 'C', 'D'].includes(parsed.correct_answer) ? parsed.correct_answer : 'A',
    explanation: (parsed.explanation || 'Verified from course study material.').trim(),
    source_pdf: originalName,
    source_page: pageNumber,
    topic: parsed.topic || topic || 'General Engineering',
    difficulty: ['easy', 'medium', 'hard'].includes((parsed.difficulty || '').toLowerCase())
      ? parsed.difficulty.toLowerCase()
      : difficulty,
    is_approved: false,
  };
}

module.exports = {
  generateMCQsFromPDF,
  regenerateSingleQuestion,
};

