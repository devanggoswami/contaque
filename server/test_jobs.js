const db = require('./db');

async function test() {
  try {
    const res = await db.query('SELECT * FROM jobs ORDER BY id DESC LIMIT 10');
    console.log("Latest Jobs:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    db.pool.end();
  }
}
test();
