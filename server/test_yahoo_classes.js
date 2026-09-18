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
    
    console.log("Analyzing Yahoo SRP HTML:");
    
    // Find all 'a' elements and print some hrefs to find the pattern
    console.log("Hrefs sample:");
    const hrefs = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && (href.includes('linkedin.com') || href.includes('RU=') || href.includes('yahoo.com/RU='))) {
        hrefs.push({ text, href: href.substring(0, 150) });
      }
    });
    console.log(hrefs.slice(0, 10));

    // Let's print the structural list items
    console.log("Checking result list containers:");
    const classes = new Set();
    $('div, li, ol, ul').each((i, el) => {
      const cls = $(el).attr('class');
      if (cls) {
        cls.split(/\s+/).forEach(c => classes.add(c));
      }
    });
    console.log("All class names (sample):", Array.from(classes).filter(c => c.includes('result') || c.includes('algo') || c.includes('comp') || c.includes('lst')).slice(0, 30));
    
  } catch (error) {
    console.error(error);
  }
}
test();
