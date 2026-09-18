const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    // Target detail pages of YellowPages (containing /mip/)
    const query = 'site:linkedin.com purchase manager of diamond jewellery paris';
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    console.log("Querying Yahoo:", url);
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
        let rawLink = a.attr('href') || '';
        
        let cleanLink = rawLink;
        if (rawLink.includes('/RU=')) {
          const part = rawLink.split('/RU=')[1];
          if (part) {
            const encodedUrl = part.split('/RK=')[0];
            if (encodedUrl) {
              cleanLink = decodeURIComponent(encodedUrl);
            }
          }
        }
        
        const snippet = $(el).find('.compText').text().trim() || $(el).find('.compText p').text().trim() || '';
        results.push({ title, link: cleanLink, snippet });
      }
    });
    
    console.log("Found:", results.length);
    console.log(JSON.stringify(results.slice(0, 5), null, 2));
  } catch (error) {
    console.error(error);
  }
}
test();
