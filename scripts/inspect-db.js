const { getDb } = require('../server/database/db');

function inspect() {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all();
  console.log(`=== TOTAL TABLES: ${tables.length} ===`);
  
  for (const t of tables) {
    const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get().c;
    const schema = db.prepare(`PRAGMA table_info("${t.name}")`).all();
    console.log(`\nTable: ${t.name} (${count} rows)`);
    console.log(`Columns: ${schema.map(c => `${c.name} (${c.type}${c.pk ? ' PK' : ''}${c.notnull ? ' NOT NULL' : ''})`).join(', ')}`);
  }
}

inspect();
