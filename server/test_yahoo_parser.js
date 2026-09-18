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
    const results = [];
    
    $('.algo').each((i, el) => {
      const a = $(el).find('.compTitle a');
      if (a.length > 0) {
        const title = a.text().trim();
        let rawLink = a.attr('href');
        
        // Yahoo search links are often wrapped in r.search.yahoo.com redirect URLs
        // e.g. https://r.search.yahoo.com/_ylt=.../RU=https%3a%2f%2fwww.linkedin.com.../RK=2/...
        // We can parse the RU parameter to get the clean direct link!
        let cleanLink = rawLink;
        if (rawLink && rawLink.includes('/RU=')) {
          const part = rawLink.split('/RU=')[1];
          if (part) {
            const encodedUrl = part.split('/RK=')[0];
            if (encodedUrl) {
              cleanLink = decodeURIComponent(encodedUrl);
            }
          }
        }
        
        const snippet = $(el).find('.compText').text().trim() || $(el).find('.compText p').text().trim();
        
        results.push({ title, link: cleanLink, snippet });
      }
    });
    
    console.log("Parsed results count:", results.length);
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(error);
  }
}
test();
