const { getDb } = require('../server/database/db');

(async () => {
  try {
    const db = getDb();
    
    // Update all SML challenges (current and history) to AI & ML, Sem 5
    const res = await db.prepare(`
      UPDATE mcq_challenges 
      SET department = 'AI & ML', semester = 5 
      WHERE id IN (
        '920f544c-c1df-4e1f-a69e-fb69d52d9cca',
        '0a0426c7-4a0b-417b-a547-59a9e4e0161b',
        '3c05eca4-14ca-49b7-bac5-57f1d97ce5d7',
        'a561dc9f-5a4a-491a-b52d-6d81b7d0f95f'
      ) OR title LIKE '%SML%'
    `).run();
    console.log('Update result:', res);

    // Verify all rows
    const rows = await db.prepare(`
      SELECT id, title, is_active, is_published, department, semester, created_at 
      FROM mcq_challenges 
      ORDER BY created_at DESC
    `).all();
    console.log('Verified mcq_challenges:', rows);
    process.exit(0);
  } catch (err) {
    console.error('Error updating challenges:', err);
    process.exit(1);
  }
})();
