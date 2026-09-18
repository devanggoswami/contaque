const db = require('./db');

async function clean() {
  try {
    const res = await db.query("UPDATE leads SET emails = NULL WHERE emails LIKE '%@%.' OR emails LIKE '%email.com' OR emails LIKE '%bootstrap%'");
    console.log('Cleaned fake emails:', res.rowCount);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

clean();
