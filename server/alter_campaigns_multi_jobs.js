require('dotenv').config();
const { Client } = require('pg');

async function updateDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Alter campaigns table target_job_id from INT to VARCHAR(255)
    await client.query(`
      ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_target_job_id_fkey;
      ALTER TABLE campaigns ALTER COLUMN target_job_id TYPE VARCHAR(255);
    `);
    
    console.log("Updated campaigns table target_job_id to VARCHAR successfully.");

  } catch (err) {
    console.error("Error updating DB:", err.message);
  } finally {
    await client.end();
  }
}

updateDb();
