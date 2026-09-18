const db = require('./db');

(async () => {
  try {
    // Delete duplicate leads from jobs 75, 76, 77
    const r = await db.query("DELETE FROM leads WHERE job_id IN (75, 76, 77)");
    console.log('Deleted duplicate leads:', r.rowCount);
    
    // Delete the duplicate jobs themselves
    const r2 = await db.query("DELETE FROM jobs WHERE id IN (75, 76, 77)");
    console.log('Deleted duplicate jobs:', r2.rowCount);
    
    // Update job 74 fetched count
    const r3 = await db.query("SELECT COUNT(*) as c FROM leads WHERE job_id = 74");
    console.log('Job 74 actual leads:', r3.rows[0].c);
    
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit(0);
})();
