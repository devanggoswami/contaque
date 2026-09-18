const { Client } = require('pg');

async function alterDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/leados'
  });
  
  try {
    await client.connect();
    await client.query("ALTER TABLE leads ADD COLUMN source_link TEXT;");
    console.log("Column source_link added successfully.");
  } catch (err) {
    if (err.code === '42701') {
      console.log("Column source_link already exists.");
    } else {
      console.error("Error altering database:", err.message);
    }
  } finally {
    await client.end();
  }
}

alterDb();
