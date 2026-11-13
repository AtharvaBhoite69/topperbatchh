// =============================================================================
// TopperBatch - Email Service (Nodemailer)
// Supports Vercel/local env vars AND runtime DB settings (platform_settings).
// =============================================================================

const nodemailer = require('nodemailer');
const env = require('../config/env');
const { getDb } = require('../database/db');

let transporter = null;
let cachedConfigHash = '';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlToPlainText(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Reset cached transporter when admin updates SMTP settings in Control Room.
 */
function resetTransporter() {
  if (transporter && typeof transporter.close === 'function') {
    try {
      transporter.close();
    } catch (_) {}
  }
  transporter = null;
  cachedConfigHash = '';
}

/**
 * Resolve SMTP settings from environment variables or platform_settings table.
 */
async function getSmtpConfig() {
  let host = env.SMTP_HOST || '';
  let port = env.SMTP_PORT || 587;
  let user = env.SMTP_USER || '';
  let pass = env.SMTP_PASS || '';
  let from = env.SMTP_FROM || '';

  // Fall back to database settings if env vars are not fully configured
  if (!host || !user || !pass) {
    try {
      const db = getDb();
      const rows = await db
        .prepare("SELECT key, value FROM platform_settings WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from')")
        .all();
      const map = {};
      for (const r of rows || []) {
        map[r.key] = r.value;
      }
      host = host || map.smtp_host || '';
      port = map.smtp_port ? parseInt(map.smtp_port, 10) : port;
      user = user || map.smtp_user || '';
      pass = pass || map.smtp_pass || '';
      from = map.smtp_from || from || user;
    } catch (err) {
      console.warn('Could not read SMTP settings from DB:', err.message);
    }
  }

  if (!from || from === 'noreply@topperbatch.com') {
    from = user || from || 'noreply@topperbatch.com';
  }

  return { host: host.trim(), port: Number(port) || 587, user: user.trim(), pass, from: from.trim() };
}

/**
 * Get or create the pooled email transporter.
 */
async function getTransporter() {
  const cfg = await getSmtpConfig();

  if (!cfg.host || !cfg.user || !cfg.pass) {
    return { transport: null, cfg };
  }

  const hash = `${cfg.host}|${cfg.port}|${cfg.user}|${cfg.pass}`;
  if (transporter && cachedConfigHash === hash) {
    return { transport: transporter, cfg };
  }

  const isGmailHost = cfg.host.toLowerCase().includes('gmail.com');

  transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: isGmailHost ? 1 : 2,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: isGmailHost ? 4 : 6,
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
  cachedConfigHash = hash;
  console.log('✅ Email transporter configured.');

  return { transport: transporter, cfg };
}

/**
 * Send an email with multipart plain-text + HTML for higher inbox deliverability.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @param {string} [text] - Optional plain-text body
 */
async function sendEmail(to, subject, html, text) {
  const { transport, cfg } = await getTransporter();

  if (!transport) {
    console.log(`📧 [Email Not Sent - SMTP Not Configured] To: ${to} | Subject: ${subject}`);
    return { messageId: 'unconfigured-smtp-skipped', skipped: true };
  }

  const isGmailHost = cfg.host.toLowerCase().includes('gmail.com');
  const extraHeaders = isGmailHost
    ? undefined
    : {
        'X-Mailin-Track': '0',
        'X-Mailin-Track-Links': '0',
      };

  try {
    const info = await transport.sendMail({
      from: `"TopperBatch" <${cfg.from}>`,
      replyTo: cfg.from,
      to,
      subject,
      text: text || htmlToPlainText(html),
      ...(html ? { html } : {}),
      ...(extraHeaders ? { headers: extraHeaders } : {}),
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('Email sending failed (non-fatal):', err.message);
    return { messageId: 'send-failed', error: err.message };
  }
}

/**
 * Send a personalized, spam-safe update email to multiple registered users.
 * Avoids BCC blasts and promotional link boxes that trigger Gmail's automated spam filter.
 */
async function sendBatchUpdateEmail({ recipients = [], subject, title, message }) {
  const uniqueMap = new Map();
  for (const item of recipients) {
    const rawEmail = typeof item === 'string' ? item : item?.email;
    const rawName = typeof item === 'string' ? '' : item?.name || '';
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (email && email.includes('@') && !uniqueMap.has(email)) {
      uniqueMap.set(email, rawName.trim());
    }
  }

  const recipientList = Array.from(uniqueMap.entries()).map(([email, name]) => ({
    email,
    firstName: name ? name.split(/\s+/)[0] : 'Student',
  }));

  if (recipientList.length === 0) {
    return { totalRecipients: 0, sentCount: 0, skipped: true, error: 'No matching recipients found.' };
  }

  const { transport, cfg } = await getTransporter();
  if (!transport) {
    return {
      totalRecipients: recipientList.length,
      sentCount: 0,
      skipped: true,
      error: 'SMTP is not configured. Save your SMTP credentials in Admin → Control Room.',
    };
  }

  const isGmailHost = cfg.host.toLowerCase().includes('gmail.com');
  const buildContent = (firstName) => {
    const headerLine = title && title.trim() !== subject.trim() ? `${title.trim()}\n\n` : '';
    const text = `Hi ${firstName},\n\n${headerLine}${message}\n\nRegards,\nTopperBatch Team`;
    return { text };
  };

  // Only attach Brevo tracking opt-out headers when using Brevo relay
  const extraHeaders = isGmailHost
    ? undefined
    : {
        'X-Mailin-Track': '0',
        'X-Mailin-Track-Links': '0',
      };

  let sentCount = 0;
  let lastError = null;

  if (recipientList.length <= 100) {
    // Gmail gets strict 1-by-1 sequential delivery with 180ms spacing to avoid anti-bot triggers
    const concurrency = isGmailHost ? 1 : 3;
    for (let i = 0; i < recipientList.length; i += concurrency) {
      const batch = recipientList.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async ({ email, firstName }) => {
          const { text } = buildContent(firstName);
          try {
            await transport.sendMail({
              from: `"TopperBatch" <${cfg.from}>`,
              replyTo: cfg.from,
              to: email,
              subject,
              text,
              ...(extraHeaders ? { headers: extraHeaders } : {}),
            });
            sentCount += 1;
          } catch (err) {
            lastError = err.message;
            console.error(`Direct email error (${email}):`, err.message);
          }
        })
      );
      if (isGmailHost && i + concurrency < recipientList.length) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }
  } else {
    const CHUNK_SIZE = 35;
    const { text } = buildContent('Student');
    const chunks = [];
    for (let i = 0; i < recipientList.length; i += CHUNK_SIZE) {
      chunks.push(recipientList.slice(i, i + CHUNK_SIZE).map((r) => r.email));
    }

    await Promise.all(
      chunks.map(async (bccList) => {
        try {
          await transport.sendMail({
            from: `"TopperBatch" <${cfg.from}>`,
            replyTo: cfg.from,
            to: cfg.from,
            bcc: bccList,
            subject,
            text,
            ...(extraHeaders ? { headers: extraHeaders } : {}),
          });
          sentCount += bccList.length;
        } catch (err) {
          lastError = err.message;
          console.error('Batch email chunk error:', err.message);
        }
      })
    );
  }

  return {
    totalRecipients: recipientList.length,
    sentCount,
    skipped: false,
    error: sentCount === 0 ? lastError : null,
  };
}

const PRODUCTION_APP_URL = 'https://topperbatchh-awmn.vercel.app';

/**
 * Resolve the public frontend base URL for email links.
 */
function resolveClientUrl(baseUrl) {
  const candidate = baseUrl || env.CLIENT_URL || PRODUCTION_APP_URL;
  if (!candidate || candidate.includes('localhost') || candidate.includes('127.0.0.1')) {
    return PRODUCTION_APP_URL;
  }
  return candidate.replace(/\/$/, '');
}

/**
 * Send password reset email.
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} [baseUrl] - Optional request origin
 */
async function sendPasswordReset(email, token, baseUrl) {
  const resetLink = `${resolveClientUrl(baseUrl)}/reset-password/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">TopperBatch - Password Reset</h2>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p style="color: #666;">This link expires in 1 hour.</p>
      <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">TopperBatch - ISS SEM, 9 POINTER FIX!</p>
    </div>
  `;
  const text = `TopperBatch - Password Reset\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link expires in 1 hour.\nIf you didn't request this, please ignore this email.`;
  return sendEmail(email, 'Reset Your TopperBatch Password', html, text);
}

/**
 * Send account approval notification.
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} [baseUrl] - Optional request origin
 */
async function sendApprovalNotification(email, name, baseUrl) {
  const loginUrl = `${resolveClientUrl(baseUrl)}/login`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222222; line-height: 1.6;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your TopperBatch account has been approved! You can now log in using the link below:</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
      <p>Explore study materials, take daily MCQ challenges, and connect with your batch.</p>
      <p>Regards,<br/>TopperBatch Team</p>
    </div>
  `;
  const text = `Hi ${name},\n\nYour TopperBatch account has been approved! You can now log in using the link below:\n${loginUrl}\n\nExplore study materials, take daily MCQ challenges, and connect with your batch.\n\nRegards,\nTopperBatch Team`;
  return sendEmail(email, 'Your TopperBatch Account is Approved', html, text);
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
      <p>Hi ${escapeHtml(name)},</p>
      <p>We're sorry, but your account registration has been declined at this time.</p>
      <p>If you believe this is a mistake, please contact the administration.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">TopperBatch - ISS SEM, 9 POINTER FIX!</p>
    </div>
  `;
  return sendEmail(email, 'TopperBatch Account Update', html);
}

/**
 * Send 6-digit OTP email verification code for batch registration.
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit verification code
 * @param {string} [name] - User's name
 */
async function sendVerificationOtp(email, otp, name) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 540px; margin: 0 auto; color: #171510; line-height: 1.6;">
      <h2 style="color: #171510; margin-bottom: 8px;">TopperBatch Email Verification</h2>
      <p>Hi ${escapeHtml(name || 'Student')},</p>
      <p>Your one-time verification code (OTP) for requesting batch access on TopperBatch is:</p>
      <div style="background: #F5E9D1; border: 2px solid #171510; padding: 14px 20px; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; margin: 18px 0; border-radius: 6px; font-family: monospace; color: #171510;">
        ${otp}
      </div>
      <p>This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      <p>If you did not request batch registration, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e0d5c0; margin: 20px 0;">
      <p style="color: #706a5b; font-size: 11px;">TopperBatch — Verified Batch Access</p>
    </div>
  `;
  const text = `Hi ${name || 'Student'},\n\nYour TopperBatch verification code is: ${otp}\n\nThis code is valid for 10 minutes.\nIf you did not request this, please ignore this email.\n\nRegards,\nTopperBatch Team`;
  return sendEmail(email, `${otp} is your TopperBatch verification code`, html, text);
}

module.exports = {
  sendEmail,
  sendBatchUpdateEmail,
  sendPasswordReset,
  sendApprovalNotification,
  sendRejectionNotification,
  sendVerificationOtp,
  resetTransporter,
  getSmtpConfig,
};
