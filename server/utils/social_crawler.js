const axios = require('axios');
const cheerio = require('cheerio');
const { extractSocialLinks } = require('./email_extractor');

/**
 * Crawls a business website homepage and contact page to extract verified social links
 * matching target platform or all platforms.
 * @param {string} siteUrl - Website URL of the business
 * @param {string} targetPlatform - e.g. 'linkedin.com', 'instagram.com', 'facebook.com', etc.
 * @param {object} options - timeoutMs, etc.
 * @returns {object|null} - extracted socials matching targetPlatform
 */
async function crawlWebsiteForSocials(siteUrl, targetPlatform = '', options = {}) {
  if (!siteUrl || typeof siteUrl !== 'string') return null;

  let cleanUrl = siteUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/$/, '');

  const timeoutMs = options.timeoutMs || 2800;
  const paths = ['', '/contact', '/about'];

  const cleanTarget = (targetPlatform || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();

  const collectedSocials = {
    instagram: null,
    facebook: null,
    linkedin: null,
    twitter: null,
    youtube: null,
    tiktok: null,
    pinterest: null,
    telegram: null
  };

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

      // Check all anchor tags
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const s = extractSocialLinks(href);
        for (const [net, link] of Object.entries(s)) {
          if (link && !collectedSocials[net]) {
            collectedSocials[net] = link;
          }
        }
      });

      // If targetPlatform is specified and we found it, no need to check further pages
      if (cleanTarget) {
        if (cleanTarget.includes('linkedin') && collectedSocials.linkedin) return collectedSocials;
        if (cleanTarget.includes('instagram') && collectedSocials.instagram) return collectedSocials;
        if (cleanTarget.includes('facebook') && collectedSocials.facebook) return collectedSocials;
        if ((cleanTarget.includes('twitter') || cleanTarget.includes('x.com')) && collectedSocials.twitter) return collectedSocials;
        if (cleanTarget.includes('youtube') && collectedSocials.youtube) return collectedSocials;
        if (cleanTarget.includes('tiktok') && collectedSocials.tiktok) return collectedSocials;
        if (cleanTarget.includes('pinterest') && collectedSocials.pinterest) return collectedSocials;
      }
    } catch {
      // Continue to next path
    }
  }

  // If a specific platform was required, check if we found it
  if (cleanTarget) {
    if (cleanTarget.includes('linkedin') && !collectedSocials.linkedin) return null;
    if (cleanTarget.includes('instagram') && !collectedSocials.instagram) return null;
    if (cleanTarget.includes('facebook') && !collectedSocials.facebook) return null;
    if ((cleanTarget.includes('twitter') || cleanTarget.includes('x.com')) && !collectedSocials.twitter) return null;
    if (cleanTarget.includes('youtube') && !collectedSocials.youtube) return null;
    if (cleanTarget.includes('tiktok') && !collectedSocials.tiktok) return null;
    if (cleanTarget.includes('pinterest') && !collectedSocials.pinterest) return null;
  }

  return collectedSocials;
}

module.exports = { crawlWebsiteForSocials };
