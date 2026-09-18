const axios = require('axios');
const cheerio = require('cheerio');

function decodeBingUrl(link) {
  if (!link) return '';
  if (link.includes('/ck/a?!') && link.includes('&u=')) {
    const uParam = link.split('&u=')[1];
    if (uParam) {
      let base64Part = uParam.split('&')[0];
      if (base64Part.startsWith('a1')) {
        base64Part = base64Part.substring(2);
      }
      base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
      while (base64Part.length % 4) {
        base64Part += '=';
      }
      try {
        return Buffer.from(base64Part, 'base64').toString('utf8');
      } catch (e) {}
    }
  }
  return link;
}

async function fetchSearchPage(query, offset) {
  const results = [];
  
  // 1. Try Bing first
  try {
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${offset}`;
    const res = await axios.get(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    $('.b_algo').each((i, el) => {
      const a = $(el).find('h2 a');
      if (a.length > 0) {
        const title = a.text().trim();
        const rawLink = a.attr('href');
        const link = decodeBingUrl(rawLink);
        const snippet = $(el).find('.b_caption p').text().trim() || $(el).find('.b_snippet').text().trim() || '';
        if (title && link && link.startsWith('http')) {
          results.push({ title, link, snippet, engine: 'bing' });
        }
      }
    });
  } catch (e) {
    console.error("Bing fetch failed:", e.message);
  }

  // 2. Fallback to Yahoo if Bing had 0 results
  if (results.length === 0) {
    try {
      const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&b=${offset}`;
      const res = await axios.get(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://search.yahoo.com/',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 8000
      });
      const $ = cheerio.load(res.data);
      $('.algo').each((i, el) => {
        const a = $(el).find('.compTitle a');
        if (a.length > 0) {
          const title = a.text().trim();
          let link = a.attr('href') || '';
          if (link.includes('/RU=')) {
            const part = link.split('/RU=')[1];
            if (part) {
              const encoded = part.split('/RK=')[0];
              if (encoded) link = decodeURIComponent(encoded);
            }
          }
          const snippet = $(el).find('.compText').text().trim() || $(el).find('.compText p').text().trim() || '';
          if (title && link && link.startsWith('http')) {
            results.push({ title, link, snippet, engine: 'yahoo' });
          }
        }
      });
    } catch (e) {}
  }

  return results;
}

async function test() {
  const queries = [
    'site:facebook.com "cafe" "abudhabi" "wa.me"',
    'site:facebook.com "cafe" "abu dhabi" "whatsapp"',
    '"cafe" "abu dhabi" "whatsapp"',
    'cafe abu dhabi whatsapp'
  ];
  for (const q of queries) {
    const res = await fetchSearchPage(q, 1);
    console.log(`Query: "${q}" -> Got ${res.length} results`);
    res.forEach((r, idx) => console.log(`  [${idx+1}] ${r.title} | ${r.link}`));
  }
}
test();
