const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const query = 'site:linkedin.com "purchase manager" "spain"';
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    console.log("Algo elements count:", $('.algo').length);
    $('.algo').each((i, el) => {
      console.log(`--- Algo #${i} ---`);
      console.log("Outer HTML:", $.html(el).substring(0, 500));
    });
  } catch (error) {
    console.error(error);
  }
}
test();
