const { Client } = require('pg');
const fs = require('fs');

async function setup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres'
  });
  
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'leados'");
    if (res.rowCount === 0) {
      await client.query("CREATE DATABASE leados");
      console.log("Database 'leados' created.");
    } else {
      console.log("Database 'leados' already exists.");
    }
  } catch (err) {
    console.error("Error creating database:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  const leadosClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/leados'
  });
  
  try {
    await leadosClient.connect();
    const schema = fs.readFileSync('schema.sql', 'utf8');
    await leadosClient.query(schema);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Error applying schema:", err.message);
  } finally {
    await leadosClient.end();
  }
}

setup();
