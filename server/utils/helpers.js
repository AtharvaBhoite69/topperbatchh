// =============================================================================
// TopperBatch - Utility Helpers
// =============================================================================

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a UUID v4 identifier
 * @returns {string} UUID v4 string
 */
function generateId() {
  return uuidv4();
}

/**
 * Generate a secure random token (hex-encoded)
 * @returns {string} 64-character hex token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 * @param {string} token - The token to hash
 * @returns {string} Hex-encoded hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Remove sensitive fields from a user object before sending to client
 * @param {Object} user - The user record from DB
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...sanitized } = user;
  return sanitized;
}

/**
 * Build LIMIT/OFFSET clause for pagination
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {{ limit: number, offset: number, page: number }}
 */
function paginate(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { limit: l, offset: (p - 1) * l, page: p };
}

/**
 * Format a date to ISO string (UTC)
 * @param {Date} [date] - Date object (defaults to now)
 * @returns {string} ISO date string
 */
function formatDate(date = new Date()) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

module.exports = {
  generateId,
  generateToken,
  hashToken,
  sanitizeUser,
  paginate,
  formatDate,
};
