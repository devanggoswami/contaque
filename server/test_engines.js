const axios = require('axios');
const cheerio = require('cheerio');

async function testEngines() {
  const query = 'site:instagram.com restaurant london';
  
  // 1. Test Yahoo UK
  try {
    const res = await axios.get(`https://uk.search.yahoo.com/search?p=${encodeURIComponent(query)}&b=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
    });
    const $ = cheerio.load(res.data);
    console.log("Yahoo UK results:", $('.algo').length);
  } catch (e) {
    console.log("Yahoo UK err:", e.response?.status || e.message);
  }

  // 2. Test DDG Lite (POST method which DDG HTML uses)
  try {
    const res = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(query)}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    const $ = cheerio.load(res.data);
    const links = $('.result-link');
    console.log("DDG Lite results:", links.length);
    if (links.length > 0) console.log("DDG Sample:", $(links[0]).text().trim(), $(links[0]).attr('href'));
  } catch (e) {
    console.log("DDG Lite err:", e.response?.status || e.message);
  }

  // 3. Test Bing Search
  try {
    const res = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
    });
    const $ = cheerio.load(res.data);
    const results = $('.b_algo');
    console.log("Bing results:", results.length);
    if (results.length > 0) console.log("Bing Sample:", $(results[0]).find('h2 a').text().trim(), $(results[0]).find('h2 a').attr('href'));
  } catch (e) {
    console.log("Bing err:", e.response?.status || e.message);
  }
}

(async () => {
  await testEngines();
})().catch(console.error);


