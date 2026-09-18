const db = require('./db');

async function test() {
  try {
    const res = await db.query('SELECT name, website, source_link FROM leads ORDER BY id DESC LIMIT 5');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    db.pool.end();
  }
}
test();
