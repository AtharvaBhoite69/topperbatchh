// =============================================================================
// TopperBatch - Environment Configuration
// =============================================================================

const path = require('path');
const dotenv = require('dotenv');

// Load .env from the parent directory (project root)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Admin emails (hardcoded, permanent)
const ADMIN_EMAILS = [
  'parthkadu05@gmail.com',
  'atharvabhoite697@gmail.com',
];

// Environment variables with defaults
const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // SMTP / Email
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@topperbatch.com',

  // Admin emails
  ADMIN_EMAILS,

  // Database path
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'topperbatch.db'),
};

/**
 * Validate that critical environment variables are set.
 * Warns in development, throws in production.
 */
function validateEnv() {
  const required = ['JWT_SECRET'];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      console.warn(`⚠️  ${message}`);
      // Provide a default JWT_SECRET for development only
      if (!env.JWT_SECRET) {
        env.JWT_SECRET = 'dev-secret-topperbatch-change-in-production';
        console.warn('⚠️  Using default JWT_SECRET for development. Set JWT_SECRET in .env for production.');
      }
    }
  }

  // Warn about optional but recommended variables
  if (!env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set. AI chatbot features will use fallback keyword search.');
  }
}

validateEnv();

env.validateEnv = validateEnv;
module.exports = env;
