const axios = require('axios');
const cheerio = require('cheerio');
const { extractWhatsApp, normalizePhoneNumber } = require('./email_extractor');

/**
 * Crawls a business website to find authentic WhatsApp evidence (wa.me, api.whatsapp.com, WhatsApp widgets, explicit labels)
 * Strictly validates mobile number format for the target country.
 * Returns { number: '+...', cleanDigits: '...', url: 'https://wa.me/...' } or null.
 */
async function crawlWebsiteForWhatsApp(siteUrl, businessName = '', locationOrAddress = '', options = {}) {
  if (!siteUrl || typeof siteUrl !== 'string') return null;

  let cleanUrl = siteUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/$/, '');

  const timeoutMs = options.timeoutMs || 2500;
  const paths = ['', '/contact'];

  for (const path of paths) {
    try {
      const targetUrl = `${cleanUrl}${path}`;
      const res = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: timeoutMs,
        maxRedirects: 3,
        validateStatus: (status) => status === 200
      });

      const html = res.data;
      if (typeof html !== 'string' || html.length < 50) continue;

      const $ = cheerio.load(html);
      let foundWa = null;

      // 1. Check anchor tags for authentic WhatsApp click-to-chat links
      $('a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="whatsapp:"]').each((_, el) => {
        if (foundWa) return;
        const href = $(el).attr('href');
        if (!href) return;
        const wa = extractWhatsApp('', businessName, href, locationOrAddress);
        if (wa) {
          foundWa = wa;
        }
      });

      if (foundWa) return foundWa;

      // 2. Check onclick, data-href, data-whatsapp, data-phone attributes for widgets
      $('[onclick*="wa.me"], [onclick*="whatsapp"], [data-whatsapp], [data-phone]').each((_, el) => {
        if (foundWa) return;
        const attrVal = $(el).attr('onclick') || $(el).attr('data-whatsapp') || $(el).attr('data-phone') || '';
        const wa = extractWhatsApp(attrVal, businessName, attrVal, locationOrAddress);
        if (wa) {
          foundWa = wa;
        }
      });

      if (foundWa) return foundWa;

      // 3. Check for explicit WhatsApp text labels in the HTML body (e.g. "WhatsApp: +44 7...", "Chat on WhatsApp: 07...")
      // Strip script and style tags first to avoid matching JS variables
      $('script, style, noscript').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ');

      const textMatch = bodyText.match(/(?:WhatsApp|Chat on WhatsApp|WA|WhatsApp Business)[:\s]*([+0-9][\d\s().-]{7,18})/i);
      if (textMatch && textMatch[0]) {
        const wa = extractWhatsApp(textMatch[0], businessName, '', locationOrAddress);
        if (wa) return wa;
      }

      const textBeforeMatch = bodyText.match(/([+0-9][\d\s().-]{7,18})[^\d+]{0,20}(?:WhatsApp|Chat on WhatsApp|WA)/i);
      if (textBeforeMatch && textBeforeMatch[0]) {
        const wa = extractWhatsApp(textBeforeMatch[0], businessName, '', locationOrAddress);
        if (wa) return wa;
      }
    } catch (err) {
      // If root homepage failed with timeout or connection error, do not retry subpaths
      if (path === '' && (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.message?.includes('timeout'))) {
        break;
      }
    }
  }

  return null;
}

module.exports = {
  crawlWebsiteForWhatsApp
};
