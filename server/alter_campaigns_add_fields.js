require('dotenv').config();
const { Client } = require('pg');

async function updateDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Alter campaigns table
    await client.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(255),
      ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS image_link TEXT,
      ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false
    `);
    
    console.log("Updated campaigns table schema successfully.");

    // Alter email_queue to allow lead_id to be NULL (already true since we didn't specify NOT NULL)
    // But let's check if we need any other constraints. We don't, it's fine.

  } catch (err) {
    console.error("Error updating DB:", err.message);
  } finally {
    await client.end();
  }
}

updateDb();
