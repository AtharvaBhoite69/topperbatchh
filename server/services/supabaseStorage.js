// =============================================================================
// TopperBatch - Supabase Private Storage Service
// Handles private buckets for PDF Question Banks & Notes attachments
// with authenticated short-lived signed URLs.
// =============================================================================

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    return supabaseAdmin;
  }

  return null;
}

const BUCKET_DOCUMENTS = 'documents';
const BUCKET_COMMUNITY = 'community_attachments';

/**
 * Ensure storage buckets exist (created as private).
 */
async function ensureBuckets() {
  const client = getSupabaseAdmin();
  if (!client) return;

  const buckets = [BUCKET_DOCUMENTS, BUCKET_COMMUNITY];
  for (const b of buckets) {
    try {
      const { data, error } = await client.storage.getBucket(b);
      if (error && error.message.includes('not found')) {
        await client.storage.createBucket(b, {
          public: false, // Strictly Private
          fileSizeLimit: 50 * 1024 * 1024, // 50MB
        });
        console.log(`✅ Created private Supabase Storage bucket: "${b}"`);
      }
    } catch (_) {}
  }
}

/**
 * Upload a file to private Supabase Storage.
 * Falls back to local storage if Supabase credentials are not provided.
 * 
 * @param {string} bucket - 'documents' or 'community_attachments'
 * @param {string} remoteFilename - destination filename
 * @param {string|Buffer} fileSource - local file path or Buffer
 * @param {string} contentType - mime type
 * @returns {Promise<{path: string, isCloud: boolean}>}
 */
async function uploadToStorage(bucket, remoteFilename, fileSource, contentType = 'application/pdf') {
  const client = getSupabaseAdmin();

  if (client) {
    try {
      await ensureBuckets();
      const fileBuffer = typeof fileSource === 'string' ? fs.readFileSync(fileSource) : fileSource;

      const { data, error } = await client.storage
        .from(bucket)
        .upload(remoteFilename, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw error;
      }

      return {
        path: remoteFilename,
        isCloud: true,
      };
    } catch (err) {
      console.warn(`Supabase Storage upload warning (${err.message}). Falling back to local storage.`);
    }
  }

  // Local fallback
  return {
    path: remoteFilename,
    isCloud: false,
  };
}

/**
 * Generate a short-lived authenticated signed URL for a private file.
 * 
 * @param {string} bucket - Bucket name
 * @param {string} remoteFilename - File path in bucket
 * @param {number} expiresIn - Expiry in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string|null>} Signed URL or null if local
 */
async function getSignedDownloadUrl(bucket, remoteFilename, expiresIn = 3600) {
  const client = getSupabaseAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(remoteFilename, expiresIn);

    if (error) {
      console.warn('Error creating signed URL:', error.message);
      return null;
    }

    return data?.signedUrl || null;
  } catch (err) {
    return null;
  }
}

/**
 * Download a file buffer from private Supabase Storage.
 */
async function downloadFromStorage(bucket, remoteFilename) {
  const client = getSupabaseAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client.storage
      .from(bucket)
      .download(remoteFilename);

    if (error || !data) return null;

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    return null;
  }
}

module.exports = {
  BUCKET_DOCUMENTS,
  BUCKET_COMMUNITY,
  getSupabaseAdmin,
  ensureBuckets,
  uploadToStorage,
  getSignedDownloadUrl,
  downloadFromStorage,
};

