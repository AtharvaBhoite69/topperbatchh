const { getDb } = require('../server/database/db');

(async () => {
  try {
    const db = getDb();
    
    // Update subjects for AIML Sem 5
    await db.prepare(`
      UPDATE subjects 
      SET department = 'AI & ML', semester_id = 5 
      WHERE name IN ('Aisc', 'SML', 'ASDD')
    `).run();

    const subjects = await db.prepare('SELECT id, name, department, semester_id FROM subjects').all();
    console.log('Updated subjects:', subjects);
    process.exit(0);
  } catch (err) {
    console.error('Error updating subjects:', err);
    process.exit(1);
  }
})();
