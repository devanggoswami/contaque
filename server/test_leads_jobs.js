const db = require('./db');

async function test() {
  try {
    const res = await db.query('SELECT job_id, name, website, source_link, category FROM leads WHERE job_id IN (28, 29, 30) ORDER BY id DESC LIMIT 10');
    console.log("Leads from jobs 28, 29, 30:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    db.pool.end();
  }
}
test();
