// =============================================================================
// TopperBatch - Migrate Local PDFs and Attachments to Supabase Storage
// =============================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  getSupabaseAdmin,
  ensureBuckets,
  uploadToStorage,
  BUCKET_DOCUMENTS,
  BUCKET_COMMUNITY,
} = require('../server/services/supabaseStorage');

async function migratePdfs() {
  console.log('🚀 Starting PDF & Document migration to Supabase Storage...');

  const client = getSupabaseAdmin();
  if (!client) {
    console.error('❌ Supabase credentials missing (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required).');
    process.exit(1);
  }

  await ensureBuckets();

  // 1. Upload Question Bank PDFs
  const uploadsDir = path.join(__dirname, '..', 'server', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter((f) => f.endsWith('.pdf'));
    console.log(`📦 Found ${files.length} PDF documents in server/uploads...`);

    for (const file of files) {
      const fullPath = path.join(uploadsDir, file);
      const res = await uploadToStorage(BUCKET_DOCUMENTS, file, fullPath, 'application/pdf');
      if (res.isCloud) {
        console.log(`  ✅ Uploaded document to Supabase [${BUCKET_DOCUMENTS}]: ${file}`);
      } else {
        console.warn(`  ⚠️ Failed to upload ${file} to cloud storage.`);
      }
    }
  }

  // 2. Upload Community Attachments
  const commDir = path.join(__dirname, '..', 'server', 'uploads', 'community');
  if (fs.existsSync(commDir)) {
    const commFiles = fs.readdirSync(commDir);
    console.log(`📦 Found ${commFiles.length} files in server/uploads/community...`);

    for (const file of commFiles) {
      const fullPath = path.join(commDir, file);
      if (fs.statSync(fullPath).isFile()) {
        const ext = path.extname(file).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.pdf') mime = 'application/pdf';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';

        const res = await uploadToStorage(BUCKET_COMMUNITY, file, fullPath, mime);
        if (res.isCloud) {
          console.log(`  ✅ Uploaded community attachment to Supabase [${BUCKET_COMMUNITY}]: ${file}`);
        }
      }
    }
  }

  console.log('\n🎉 Supabase Storage Migration Completed!');
}

migratePdfs().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

