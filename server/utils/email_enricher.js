const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../db');
const { 
  extractEmailFromText, 
  extractSocialLinks, 
  extractMobile, 
  extractWhatsApp 
} = require('./email_extractor');

/**
 * Searches the web for a business's online footprint (website, email, socials, whatsapp)
 * Used when a lead has no website or when its website didn't yield email/socials.
 */
const discoverOnlineFootprint = async (name, location) => {
  if (!name || name.length < 3) return null;
  
  // Clean name from noise
  const cleanName = name.replace(/^(?:Call\s*\/?\s*WhatsApp\s*[:\-]?\s*[+0-9\s-]+\s*)/i, '')
                        .replace(/[^\w\s&'-]/g, ' ')
                        .replace(/\s+/g, ' ').trim();
  const cleanLoc = (location || '').replace(/[^\w\s,]/g, ' ').replace(/\s+/g, ' ').trim();
  const q = `"${cleanName}" "${cleanLoc}" contact email instagram facebook`.trim();
  const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = $('.algo');
    if (results.length === 0) return null;

    let foundEmail = null;
    let foundWebsite = null;
    let foundWhatsApp = null;
    let foundMobile = null;
    const foundSocials = {
      instagram: null,
      facebook: null,
      linkedin: null,
      twitter: null,
      youtube: null,
      tiktok: null,
      pinterest: null,
      telegram: null
    };

    results.slice(0, 6).each((i, el) => {
      const a = $(el).find('.compTitle a');
      let link = a.attr('href') || '';
      if (link.includes('/RU=')) {
        const part = link.split('/RU=')[1];
        if (part) {
          const encoded = part.split('/RK=')[0];
          if (encoded) link = decodeURIComponent(encoded);
        }
      }
      const title = a.text().trim();
      const snippet = $(el).find('.compText').text().trim();
      const combined = `${title} ${snippet} ${link}`;

      // Email
      const em = extractEmailFromText(snippet);
      if (!foundEmail && em) foundEmail = em;

      // WhatsApp / Mobile
      const wa = extractWhatsApp(snippet, title, link, location);
      if (wa) {
        if (!foundWhatsApp) foundWhatsApp = wa.url;
        if (!foundMobile) foundMobile = wa.number;
      }

      // Socials
      const soc = extractSocialLinks(combined);
      for (const k of Object.keys(foundSocials)) {
        if (!foundSocials[k] && soc[k]) foundSocials[k] = soc[k];
      }

      // Discovered website (exclude search engines and directory aggregators)
      if (!foundWebsite && link.startsWith('http')) {
        const lower = link.toLowerCase();
        const isAggregator = lower.includes('yahoo.') || lower.includes('google.') || lower.includes('facebook.') ||
                             lower.includes('instagram.') || lower.includes('linkedin.') || lower.includes('yelp.') ||
                             lower.includes('tripadvisor.') || lower.includes('yellowpages.') || lower.includes('zomato.');
        if (!isAggregator) {
          try {
            const parsed = new URL(link);
            foundWebsite = `${parsed.protocol}//${parsed.hostname}`;
          } catch(e) {}
        }
      }
    });

    return {
      email: foundEmail,
      website: foundWebsite,
      whatsapp: foundWhatsApp,
      mobile: foundMobile,
      socials: foundSocials
    };
  } catch (e) {
    return null;
  }
};

// Rate-limited footprint discovery queue to prevent Yahoo rate-limiting & socket hangs
let footprintQueue = Promise.resolve();
const queueFootprintDiscovery = (name, location) => {
  return new Promise((resolve) => {
    footprintQueue = footprintQueue.then(async () => {
      try {
        await new Promise(r => setTimeout(r, 1200)); // Pace out Yahoo requests by 1.2s
        const res = await discoverOnlineFootprint(name, location);
        resolve(res);
      } catch (e) {
        resolve(null);
      }
    });
  });
};

/**
 * Universal Enrichment Worker: Extracts Email, Mobile, WhatsApp, and all 8 Socials
 */
const runEnrichEmail = async (website, leadId, name = '', location = '') => {
  let cleanUrl = (website || '').trim().replace(/\/$/, '');
  const isSocialWebsite = cleanUrl.includes('facebook.com') || cleanUrl.includes('instagram.com') || 
                          cleanUrl.includes('linkedin.com') || cleanUrl.includes('yellowpages.com');

  let foundEmail = null;
  let foundMobile = null;
  let foundWhatsApp = null;
  let discoveredWebsite = null;
  const mergedSocials = {
    instagram: null,
    facebook: null,
    linkedin: null,
    twitter: null,
    youtube: null,
    tiktok: null,
    pinterest: null,
    telegram: null
  };

  // If website exists and is not a blocked aggregator, crawl website pages
  if (cleanUrl && cleanUrl !== 'None' && !isSocialWebsite) {
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const pathsToTry = ['', '/contact', '/about', '/contact-us', '/contacts', '/about-us'];
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    for (const path of pathsToTry) {
      try {
        const urlToFetch = `${cleanUrl}${path}`;
        const res = await axios.get(urlToFetch, { 
          timeout: 4500, 
          maxContentLength: 1024 * 768, 
          maxRedirects: 5,
          headers 
        });

        // 1. Email
        const email = extractEmailFromText(res.data);
        if (!foundEmail && email) foundEmail = email;

        // 2. Mobile / Phone
        const mob = extractMobile(res.data);
        if (!foundMobile && mob) foundMobile = mob;

        // 3. Direct WhatsApp link
        const wa = extractWhatsApp(res.data, '', cleanUrl, location);
        if (wa) {
          if (!foundWhatsApp) foundWhatsApp = wa.url;
          if (!foundMobile) foundMobile = wa.number;
        }

        // 4. Social Links (all 8 networks)
        const socials = extractSocialLinks(res.data);
        for (const key of Object.keys(mergedSocials)) {
          if (!mergedSocials[key] && socials[key]) {
            mergedSocials[key] = socials[key];
          }
        }

        // Break early if we already found email + mobile + at least 2 socials
        const foundSocialCount = Object.values(mergedSocials).filter(Boolean).length;
        if (foundEmail && (foundMobile || foundWhatsApp) && foundSocialCount >= 2) {
          break;
        }
      } catch (e) {
        if (e.response && (e.response.status === 403 || e.response.status === 401)) {
          break;
        }
      }
    }
  }

  // Fallback Web Discovery: If email or socials are still missing and we have a name
  const missingSocials = Object.values(mergedSocials).filter(Boolean).length === 0;
  if ((!foundEmail || missingSocials) && name && name.length >= 3) {
    try {
      const footprint = await queueFootprintDiscovery(name, location);
      if (footprint) {
        if (!foundEmail && footprint.email) foundEmail = footprint.email;
        if (!foundMobile && footprint.mobile) foundMobile = footprint.mobile;
        if (!foundWhatsApp && footprint.whatsapp) foundWhatsApp = footprint.whatsapp;
        if (!cleanUrl && footprint.website) discoveredWebsite = footprint.website;
        if (footprint.socials) {
          for (const k of Object.keys(mergedSocials)) {
            if (!mergedSocials[k] && footprint.socials[k]) {
              mergedSocials[k] = footprint.socials[k];
            }
          }
        }
      }
    } catch(err) {}
  }

  // Update lead with all discovered contacts, socials, and phone/whatsapp
  const hasAnyData = foundEmail || foundMobile || foundWhatsApp || discoveredWebsite || Object.values(mergedSocials).some(Boolean);
  if (hasAnyData) {
    try {
      await db.query(
        `UPDATE leads SET 
           emails = COALESCE(emails, $1), 
           instagram = COALESCE(instagram, $2), 
           facebook = COALESCE(facebook, $3), 
           youtube = COALESCE(youtube, $4), 
           linkedin = COALESCE(linkedin, $5), 
           mobile = COALESCE(mobile, $6),
           twitter = COALESCE(twitter, $7),
           tiktok = COALESCE(tiktok, $8),
           pinterest = COALESCE(pinterest, $9),
           telegram = COALESCE(telegram, $10),
           whatsapp = COALESCE(whatsapp, $11),
           phone = COALESCE(phone, $12),
           website = COALESCE(website, $13)
         WHERE id = $14`, 
        [
          foundEmail, 
          mergedSocials.instagram, 
          mergedSocials.facebook, 
          mergedSocials.youtube, 
          mergedSocials.linkedin, 
          foundMobile, 
          mergedSocials.twitter, 
          mergedSocials.tiktok, 
          mergedSocials.pinterest, 
          mergedSocials.telegram, 
          foundWhatsApp,
          foundMobile, // also backfill phone if missing
          discoveredWebsite,
          leadId
        ]
      );
      console.log(`Enriched lead ${leadId} with socials & contacts (${[foundEmail ? 'email' : null, (foundMobile || foundWhatsApp) ? 'phone/wa' : null, Object.values(mergedSocials).filter(Boolean).length ? 'socials' : null].filter(Boolean).join(', ')})`);
    } catch (dbErr) {
      console.error(`Error updating enriched lead ${leadId}:`, dbErr.message);
    }
  }
};

// Concurrency queue: limits simultaneous website enrichment to 6 workers
let activeEnrichers = 0;
const enrichQueue = [];

const processEnrichQueue = () => {
  if (activeEnrichers >= 6 || enrichQueue.length === 0) return;
  const { website, leadId, name, location, resolve, reject } = enrichQueue.shift();
  activeEnrichers++;
  runEnrichEmail(website, leadId, name, location)
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeEnrichers--;
      processEnrichQueue();
    });
};

const enrichEmail = (website, leadId, name = '', location = '') => {
  return new Promise((resolve, reject) => {
    enrichQueue.push({ website, leadId, name, location, resolve, reject });
    processEnrichQueue();
  });
};

module.exports = { enrichEmail };
