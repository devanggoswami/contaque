const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const query = 'site:linkedin.com purchase manager jewellery spain';
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=1`;
  console.log("URL:", url);
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  const $ = cheerio.load(response.data);
  
  console.log("Page title:", $('title').text());
  console.log("b_algo count:", $('.b_algo').length);
  
  $('.b_algo').each((i, el) => {
    const a = $(el).find('h2 a');
    const title = a.text().trim();
    let link = a.attr('href') || '';
    
    // Decode Bing redirect URL
    let decodedLink = link;
    if (link.includes('bing.com/ck/a')) {
      const uParam = link.split('&u=')[1];
      if (uParam) {
        let base64Part = uParam.split('&')[0];
        if (base64Part.startsWith('a1')) base64Part = base64Part.substring(2);
        base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
        while (base64Part.length % 4) base64Part += '=';
        try {
          decodedLink = Buffer.from(base64Part, 'base64').toString('utf8');
        } catch (e) {}
      }
    }
    
    console.log(`\n[${i}] Title: ${title}`);
    console.log(`    Raw href: ${link.substring(0, 100)}...`);
    console.log(`    Decoded:  ${decodedLink}`);
    console.log(`    Has linkedin: ${decodedLink.toLowerCase().includes('linkedin.com')}`);
  });
}
test().catch(console.error);
