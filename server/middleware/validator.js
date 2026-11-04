// =============================================================================
// TopperBatch - Input Validation Middleware
// =============================================================================

const { body, validationResult } = require('express-validator');

/**
 * Process validation results and return errors if any.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
}

/**
 * Registration validation chain
 */
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.'),
  body('fullName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Full name must be at least 2 characters long.'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
  handleValidationErrors,
];

/**
 * Login validation chain
 */
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
  handleValidationErrors,
];

/**
 * Document validation chain
 */
const documentValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Document title is required.'),
  body('subject_id')
    .notEmpty()
    .withMessage('Subject is required.'),
  handleValidationErrors,
];

/**
 * Community message validation chain
 */
const messageValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required.')
    .isLength({ max: 2000 })
    .withMessage('Message must be 2000 characters or less.'),
  handleValidationErrors,
];

/**
 * Question validation chain
 */
const questionValidation = [
  body('question_text')
    .trim()
    .notEmpty()
    .withMessage('Question text is required.'),
  body('options')
    .isArray({ min: 4, max: 4 })
    .withMessage('Exactly 4 answer options are required.'),
  body('options.*.option_text')
    .trim()
    .notEmpty()
    .withMessage('Each option must have text.'),
  body('options')
    .custom((options) => {
      const correctCount = options.filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        throw new Error('Exactly one option must be marked as correct.');
      }
      return true;
    }),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  documentValidation,
  messageValidation,
  questionValidation,
  handleValidationErrors,
};
