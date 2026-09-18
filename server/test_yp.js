const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const keyword = 'cafe';
    const location = 'New York, NY';
    const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(keyword)}&geo_location_terms=${encodeURIComponent(location)}`;
    console.log("Querying YellowPages:", url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    console.log("Status:", response.status);
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('.search-results .result').each((i, el) => {
      const name = $(el).find('a.business-name span').text().trim();
      const phone = $(el).find('.phones').text().trim();
      const street = $(el).find('.street-address').text().trim();
      const locality = $(el).find('.locality').text().trim();
      const address = `${street}, ${locality}`.replace(/^,\s*|,\s*$/g, '').trim() || 'New York, NY';
      const website = $(el).find('a.track-visit-website').attr('href') || '';
      
      const ypLink = $(el).find('a.business-name').attr('href');
      const sourceLink = ypLink ? `https://www.yellowpages.com${ypLink}` : '';
      
      if (name) {
        results.push({ name, phone, address, website, sourceLink });
      }
    });
    
    console.log("Found:", results.length);
    console.log(JSON.stringify(results.slice(0, 5), null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}
test();
