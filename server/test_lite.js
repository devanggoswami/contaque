const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const response = await axios.post('https://lite.duckduckgo.com/lite/', 
      'q=site:linkedin.com "purchase manager" "spain"', 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );
    console.log("Status:", response.status);
    const $ = cheerio.load(response.data);
    const results = [];
    
    // In DDG Lite, results are in a table structure
    $('td.result-link').each((i, el) => {
      const a = $(el).find('a');
      const title = a.text().trim();
      const link = a.attr('href');
      // The snippet is usually in the next row or a class
      const tr = $(el).closest('tr');
      const snippetTr = tr.next();
      const snippet = snippetTr.find('td.result-snippet').text().trim();
      
      results.push({ title, link, snippet });
    });
    
    console.log("Found:", results.length);
    console.log(JSON.stringify(results.slice(0, 5), null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}
test();
