// =============================================================================
// TopperBatch - Sample Data Seeder (Disabled - Clean State Preserved)
// =============================================================================

const { seedDatabase } = require('./seed');

async function seedSampleData() {
  console.log('ℹ️ Sample data seeding is disabled. Maintaining clean database state.');
  seedDatabase();
}

if (require.main === module) {
  seedSampleData().then(() => process.exit(0));
}

module.exports = { seedSampleData };
