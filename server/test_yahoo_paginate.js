const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const query = 'site:linkedin.com "purchase manager" "spain"';
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&b=11`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('.algo').each((i, el) => {
      const a = $(el).find('.compTitle a');
      if (a.length > 0) {
        const title = a.text().trim();
        results.push({ title });
      }
    });
    
    console.log("Pagination test - Page 2 results count:", results.length);
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
  } catch (error) {
    console.error(error);
  }
}
test();
