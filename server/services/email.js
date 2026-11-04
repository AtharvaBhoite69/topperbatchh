// =============================================================================
// TopperBatch - Email Service (Nodemailer)
// =============================================================================

const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

/**
 * Get or create the email transporter.
 */
function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    console.log('✅ Email transporter configured.');
  } else {
    console.warn('⚠️  SMTP not configured. Emails will be logged to console in development.');
  }

  return transporter;
}

/**
 * Send an email.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 */
async function sendEmail(to, subject, html) {
  const transport = getTransporter();

  if (!transport) {
    console.log(`📧 [Email Not Sent - SMTP Not Configured] To: ${to} | Subject: ${subject}`);
    return { messageId: 'unconfigured-smtp-skipped', skipped: true };
  }

  try {
    const info = await transport.sendMail({
      from: `"TopperBatch" <${env.SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('Email sending failed (non-fatal):', err.message);
    return { messageId: 'send-failed', error: err.message };
  }
}

/**
 * Send password reset email.
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 */
async function sendPasswordReset(email, token) {
  const resetLink = `${env.CLIENT_URL}/reset-password?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">TopperBatch - Password Reset</h2>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetLink}" 
         style="display: inline-block; padding: 12px 24px; background-color: #6c63ff; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #666;">This link expires in 1 hour.</p>
      <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">TopperBatch - ISS SEM, 9 POINTER FIX!</p>
    </div>
  `;
  return sendEmail(email, 'Reset Your TopperBatch Password', html);
}

/**
 * Send account approval notification.
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
async function sendApprovalNotification(email, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Welcome to TopperBatch! 🎉</h2>
      <p>Hi ${name},</p>
      <p>Your account has been approved! You can now log in and start using TopperBatch.</p>
      <a href="${env.CLIENT_URL}/login" 
         style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Log In Now
      </a>
      <p>Explore study materials, take daily quizzes, and connect with your community!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">TopperBatch - ISS SEM, 9 POINTER FIX!</p>
    </div>
  `;
  return sendEmail(email, 'Your TopperBatch Account is Approved!', html);
}

/**
 * Send account rejection notification.
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
async function sendRejectionNotification(email, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">TopperBatch Account Update</h2>
      <p>Hi ${name},</p>
      <p>We're sorry, but your account registration has been declined at this time.</p>
      <p>If you believe this is a mistake, please contact the administration.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">TopperBatch - ISS SEM, 9 POINTER FIX!</p>
    </div>
  `;
  return sendEmail(email, 'TopperBatch Account Update', html);
}

module.exports = {
  sendEmail,
  sendPasswordReset,
  sendApprovalNotification,
  sendRejectionNotification,
};
