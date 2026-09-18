const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: 'gyms in Mumbai' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    console.log("Status:", response.status);
    console.log("Response body length:", response.data.length);
    if (response.data.includes("ddg-lms")) {
      console.log("Contains ddg-lms (anti-bot page)");
    } else {
      console.log("HTML Sample:", response.data.substring(0, 1000));
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}
test();
