require('dotenv').config();
const { Client } = require('pg');

async function alterDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    const columns = [
      'instagram TEXT',
      'facebook TEXT',
      'youtube TEXT',
      'linkedin TEXT',
      'mobile TEXT'
    ];
    
    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE leads ADD COLUMN ${col};`);
        console.log(`Column ${col} added successfully.`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`Column ${col} already exists.`);
        } else {
          console.error(`Error adding column ${col}:`, err.message);
        }
      }
    }
  } finally {
    await client.end();
  }
}

alterDb();
