const isValidEmailAddress = (email) => {
  if (!email || typeof email !== 'string') return false;
  const lower = email.trim().toLowerCase();
  
  // RFC compliant regex: local part @ domain . TLD (2 to 24 letters)
  const strictRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/;
  if (!strictRegex.test(lower)) return false;

  // Reject versions, numbers in TLD, double dots, font weights
  if (/@v?\d+\.\d+/i.test(lower)) return false;
  if (/\.\./.test(lower)) return false;
  if (/wght@/i.test(lower)) return false;

  // Reject file extensions mistakenly matched
  const forbiddenExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.map', '.ico'];
  if (forbiddenExts.some(ext => lower.endsWith(ext))) return false;

  // Reject known dummy, template, font, and framework placeholder domains
  const dummyDomains = [
    'example.com', 'example.org', 'example.net', 'mysite.com', 'domain.com', 
    'yourdomain.com', 'email.com', 'sample.com', 'latofonts.com', 'wixpress.com', 
    'sentry.io', 'schema.org', 'w3.org', 'github.com', 'test.com', 'dummy.com',
    'googleapis.com', 'google.com', 'facebook.com', 'instagram.com', 'twitter.com',
    'cloudflare.com', 'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'wordpress.org',
    'themeforest.net', 'envato.com', 'shopify.com', 'mailinator.com'
  ];
  if (dummyDomains.some(d => lower.endsWith('@' + d) || lower.endsWith('.' + d))) return false;

  // Reject dummy placeholder localparts
  const dummyPrefixes = ['noreply@', 'no-reply@', 'user@', 'demo@', 'test@', 'placeholder@', 'sample@'];
  if (dummyPrefixes.some(p => lower.startsWith(p))) return false;

  return lower.length >= 6 && lower.length <= 100;
};

const extractEmailFromText = (text) => {
  if (!text) return null;
  // Match candidate email tokens with letter TLDs
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24})\b/gi;
  const matches = text.match(emailRegex);
  if (!matches) return null;

  let validEmails = [...new Set(matches.map(m => m.toLowerCase()))].filter(isValidEmailAddress);
  if (validEmails.length === 0) return null;

  // Prioritize business role-based emails
  const roleKeywords = ['info', 'contact', 'sales', 'support', 'manager', 'hr', 'hello', 'office', 'admin'];
  validEmails.sort((a, b) => {
    const aScore = roleKeywords.some(k => a.startsWith(k + '@')) ? 1 : 0;
    const bScore = roleKeywords.some(k => b.startsWith(k + '@')) ? 1 : 0;
    return bScore - aScore;
  });

  return validEmails[0] || null;
};

const extractSocialLinks = (text) => {
  const socials = { 
    instagram: null, 
    facebook: null, 
    linkedin: null, 
    twitter: null, 
    youtube: null, 
    tiktok: null, 
    pinterest: null, 
    telegram: null 
  };
  if (!text) return socials;

  // Instagram
  const igMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|stories\/|direct\/|accounts\/|terms\/|privacy\/|developer\/)([a-zA-Z0-9._-]+)/i);
  if (igMatch && igMatch[1] && igMatch[1].length > 1) {
    socials.instagram = `https://www.instagram.com/${igMatch[1]}/`;
  }

  // Facebook (matches profiles, business pages, p/, pages/...)
  const fbMatch = text.match(/https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/(?!sharer|share|policies|login|help|dialog|recover|events|groups|r\.php)([a-zA-Z0-9.\-_/]+)(?=[?"'\s>#]|$)/i);
  if (fbMatch && fbMatch[1]) {
    let fbPath = fbMatch[1].replace(/\/$/, '');
    if (!fbPath.includes('sharer') && !fbPath.includes('plugins') && fbPath.length > 2) {
      socials.facebook = `https://www.facebook.com/${fbPath}`;
    }
  }

  // LinkedIn (company, in, school, showcase)
  const liMatch = text.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/([a-zA-Z0-9._-]+)/i);
  if (liMatch && liMatch[0]) {
    socials.linkedin = liMatch[0].replace(/\/$/, '');
  }

  // Twitter / X
  const twMatch = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(?!intent|share|i\/|login|tos|privacy|home)([a-zA-Z0-9_]{1,25})/i);
  if (twMatch && twMatch[1]) {
    socials.twitter = `https://x.com/${twMatch[1]}`;
  }

  // YouTube (@handle, channel, c/, user)
  const ytMatch = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:@[a-zA-Z0-9._-]+|channel\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9._-]+|user\/[a-zA-Z0-9._-]+)/i);
  if (ytMatch && ytMatch[0]) {
    socials.youtube = ytMatch[0].replace(/\/$/, '');
  }

  // TikTok
  const ttMatch = text.match(/https?:\/\/(?:www\.)?tiktok\.com\/(@[a-zA-Z0-9._-]+)/i);
  if (ttMatch && ttMatch[1]) {
    socials.tiktok = `https://www.tiktok.com/${ttMatch[1]}`;
  }

  // Pinterest
  const pinMatch = text.match(/https?:\/\/(?:[a-z]{2}\.)?pinterest\.com\/(?!pin\/|explore\/|search\/)([a-zA-Z0-9._-]+)/i);
  if (pinMatch && pinMatch[1]) {
    socials.pinterest = `https://www.pinterest.com/${pinMatch[1]}/`;
  }

  // Telegram
  const tgMatch = text.match(/https?:\/\/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,32})/i);
  if (tgMatch && tgMatch[1]) {
    socials.telegram = `https://t.me/${tgMatch[1]}`;
  }

  return socials;
};

const extractMobile = (text) => {
  if (!text) return null;
  
  // Look for whatsapp api links first
  const waMatch = text.match(/href=["'](https?:\/\/(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/)([+0-9]+)[^"']*)["']/i);
  if (waMatch) return '+' + waMatch[2].replace(/\D/g, ''); // return clean number

  // Look for tel: links
  const telMatch = text.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch) {
    const cleanNum = telMatch[1].replace(/[^\d+]/g, '');
    if (cleanNum.length >= 10) return cleanNum;
  }

  // Fallback: look for generic mobile format in text (e.g. +971 50 123 4567 or +1 (555) 123-4567)
  const genericMatch = text.match(/(?:WhatsApp|Mobile|Call us)[:\s]*([+0-9][\d\s()-]{9,15})/i);
  if (genericMatch) {
    const cleanNum = genericMatch[1].replace(/[^\d+]/g, '');
    if (cleanNum.length >= 10) return cleanNum;
  }

  return null;
};

const { getCountryData, detectCountryCode, isCountryCodeMatch, isMobileNumberForCountry, COUNTRY_DIALING_DATA } = require('./country_codes');

const COUNTRY_DIALING_CODES = COUNTRY_DIALING_DATA;

const normalizePhoneNumber = (rawPhone, locationHint = '', requireMobile = false) => {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  // If starts with 00, convert 00 to +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  const countryData = getCountryData(locationHint);
  const countryCode = countryData ? countryData.code : null;
  const altCodes = countryData ? (countryData.altCodes || []) : [];

  // If already has +, e.g. +971501234567, +37760791234, or +919876543210
  if (cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      // If locationHint provided and country detected, enforce country matching
      if (countryCode && !isCountryCodeMatch(digits, countryCode, altCodes)) {
        return null; // Foreign phone number rejected!
      }
      if (requireMobile && countryCode && !isMobileNumberForCountry(digits, countryCode)) {
        return null; // Landline rejected for WhatsApp!
      }
      return { formatted: '+' + digits, cleanDigits: digits };
    }
    return null;
  }

  // If phone does not start with +:
  // NEVER prepend country code blindly!
  // ONLY prepend if digits match the specific national mobile format of that country:
  let digits = cleaned.replace(/\D/g, '');

  // Spain (+34): Mobile starts with 6 or 7, 9 digits
  if (countryCode === '34') {
    if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) {
      const full = '34' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    if (digits.startsWith('34') && digits.length === 11 && (digits.substring(2, 3) === '6' || digits.substring(2, 3) === '7')) {
      return { formatted: '+' + digits, cleanDigits: digits };
    }
    return null;
  }

  // Italy (+39): Mobile starts with 3, 10 digits
  if (countryCode === '39') {
    if (digits.length === 10 && digits.startsWith('3')) {
      const full = '39' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    if (digits.startsWith('39') && digits.length === 12 && digits.substring(2, 3) === '3') {
      return { formatted: '+' + digits, cleanDigits: digits };
    }
    return null;
  }

  // France (+33): Mobile starts with 06 or 07 (10 digits) or 6/7 (9 digits)
  if (countryCode === '33') {
    if ((digits.startsWith('06') || digits.startsWith('07')) && digits.length === 10) {
      const full = '33' + digits.substring(1);
      return { formatted: '+' + full, cleanDigits: full };
    }
    if ((digits.startsWith('6') || digits.startsWith('7')) && digits.length === 9) {
      const full = '33' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null;
  }

  // Germany (+49): Mobile starts with 15, 16, 17
  if (countryCode === '49') {
    if (digits.startsWith('01') && digits.length >= 10 && digits.length <= 12) {
      const full = '49' + digits.substring(1);
      return { formatted: '+' + full, cleanDigits: full };
    }
    if (digits.startsWith('1') && digits.length >= 10 && digits.length <= 11) {
      const full = '49' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null;
  }

  if (countryCode === '377') {
    // Monaco local mobile: 8 digits starting with 4 or 6
    if (digits.length === 8 && (digits.startsWith('4') || digits.startsWith('6'))) {
      const full = '377' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    // French mobile: 10 digits starting with 06 or 07
    if (digits.length === 10 && (digits.startsWith('06') || digits.startsWith('07'))) {
      const full = '33' + digits.substring(1);
      return { formatted: '+' + full, cleanDigits: full };
    }
    // Monaco landline (only allowed when mobile is NOT required)
    if (!requireMobile && digits.length === 8 && digits.startsWith('9')) {
      const full = '377' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null; // All other random numbers (Argentine, Mexican, etc.) REJECTED!
  }

  if (countryCode === '971') {
    if (digits.startsWith('05') && digits.length === 10) {
      const full = '971' + digits.substring(1);
      return { formatted: '+' + full, cleanDigits: full };
    }
    if (digits.startsWith('5') && digits.length === 9) {
      const full = '971' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null;
  }

  if (countryCode === '91') {
    if (digits.startsWith('0') && digits.length === 11) digits = digits.substring(1);
    if (digits.length === 10 && ['6', '7', '8', '9'].includes(digits[0])) {
      const full = '91' + digits;
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null;
  }

  if (countryCode === '44') {
    if (digits.startsWith('07') && digits.length === 11) {
      const full = '44' + digits.substring(1);
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null;
  }

  if (countryCode === '966') {
    if (digits.startsWith('05') && digits.length === 10) {
      const full = '966' + digits.substring(1);
      return { formatted: '+' + full, cleanDigits: full };
    }
    return null;
  }

  // If already starts with country code without +
  if (countryCode && digits.startsWith(countryCode) && digits.length >= 9 && digits.length <= 15) {
    if (requireMobile && !isMobileNumberForCountry(digits, countryCode)) return null;
    return { formatted: '+' + digits, cleanDigits: digits };
  }

  return null;
};

const sanitizeSnippetText = (text) => {
  return (text || '')
    .replace(/https?:\/\/[^\s]+/gi, ' ')
    .replace(/(?:www\.)?[a-zA-Z0-9-]+\.(?:com|org|net|es|fr|mc|it|de|edu|gov|co|uk|io|ai)[^\s]*/gi, ' ')
    .replace(/›[^\s]+/g, ' ')
    .replace(/\s+/g, ' ');
};

const extractWhatsApp = (snippet, title = '', link = '', locationHint = '') => {
  let text = '';
  let href = '';
  let loc = locationHint;

  if (typeof title === 'string' && (title.includes('+') || title.length > 30) && !link) {
    text = snippet || '';
    loc = title;
  } else {
    text = `${snippet || ''} ${title || ''}`;
    href = link || '';
  }

  const countryData = getCountryData(loc);
  const cc = countryData ? countryData.code : null;

  // 1. Direct check for wa.me / api.whatsapp.com with phone digits ONLY
  const waDomainRegex = /(?:https?:\/\/)?(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/)([0-9+]{8,18})/i;
  
  // Check href FIRST, but ONLY if href is actually a whatsapp domain
  const hrefWaMatch = href.match(waDomainRegex);
  if (hrefWaMatch && hrefWaMatch[1]) {
    const normalized = normalizePhoneNumber(hrefWaMatch[1], loc, false);
    if (normalized) {
      return {
        number: normalized.formatted,
        cleanDigits: normalized.cleanDigits,
        url: `https://wa.me/${normalized.cleanDigits}`
      };
    }
  }

  // Also check if text has direct wa.me link
  const textWaMatch = text.match(waDomainRegex);
  if (textWaMatch && textWaMatch[1]) {
    const normalized = normalizePhoneNumber(textWaMatch[1], loc, false);
    if (normalized) {
      return {
        number: normalized.formatted,
        cleanDigits: normalized.cleanDigits,
        url: `https://wa.me/${normalized.cleanDigits}`
      };
    }
  }

  // 2. CRITICAL FIX: SANITIZE TEXT before searching for phone numbers or labels!
  // Strip out all URLs, domain paths, and search engine breadcrumbs so Facebook/IG IDs, post IDs, photo IDs,
  // and reel IDs (e.g. fbid=2000..., /reel/1329..., /posts/.../6401...) are NEVER scanned as phone numbers!
  const cleanText = sanitizeSnippetText(text);

  // 3. Explicit WhatsApp label in sanitized text (AFTER label, e.g. WhatsApp: +34 689 33 25 20)
  const waLabelAfter = cleanText.match(/(?:whatsapp|wa\.me|chat on wa|contact on whatsapp|wa:?)[^\d+]{0,25}([+0-9][\d\s().-]{7,18})/i);
  if (waLabelAfter && waLabelAfter[1]) {
    const normalized = normalizePhoneNumber(waLabelAfter[1], loc, true);
    if (normalized) {
      return {
        number: normalized.formatted,
        cleanDigits: normalized.cleanDigits,
        url: `https://wa.me/${normalized.cleanDigits}`
      };
    }
  }

  // Explicit WhatsApp label in sanitized text (BEFORE label, e.g. 689 33 25 20 (WhatsApp), 689 33 25 20 - WhatsApp)
  const waLabelBefore = cleanText.match(/([+0-9][\d\s().-]{7,18})[^\d+]{0,25}(?:whatsapp|wa\.me|chat on wa|contact on whatsapp)/i);
  if (waLabelBefore && waLabelBefore[1]) {
    const normalized = normalizePhoneNumber(waLabelBefore[1], loc, true);
    if (normalized) {
      return {
        number: normalized.formatted,
        cleanDigits: normalized.cleanDigits,
        url: `https://wa.me/${normalized.cleanDigits}`
      };
    }
  }

  // 4. Country-specific mobile formats ONLY IF snippet explicitly mentions WhatsApp
  const hasWaMention = /(?:whatsapp|wa\.me|chat on wa|contact on whatsapp|wa:)/i.test(cleanText);
  if (hasWaMention) {
    if (cc === '34') {
      // Spain (+34): Mobile starts with 6 or 7, 9 digits
      const spMatch = cleanText.match(/(?:(?:\+|00)34[\s.-]?)?([67]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/);
      if (spMatch && spMatch[1]) {
        const cleanDigits = spMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 9) {
          return { number: `+34${cleanDigits}`, cleanDigits: `34${cleanDigits}`, url: `https://wa.me/34${cleanDigits}` };
        }
      }
    } else if (cc === '377') {
      // Monaco (+377): Mobile 4x xx xx xx, 6x xx xx xx (8 digits)
      const monacoMatch = cleanText.match(/(?:(?:\+|00)377[\s.-]?)?(?:0)?([46]\d{1}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})\b/);
      if (monacoMatch && monacoMatch[1]) {
        const cleanDigits = monacoMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 8) {
          return { number: `+377${cleanDigits}`, cleanDigits: `377${cleanDigits}`, url: `https://wa.me/377${cleanDigits}` };
        }
      }
      // French mobile in Monaco (+33 6 / 7)
      const frMatch = cleanText.match(/(?:(?:\+|00)33[\s.-]?)?(?:0)?([67]\d{1}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})\b/);
      if (frMatch && frMatch[1]) {
        const cleanDigits = frMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 9) {
          return { number: `+33${cleanDigits}`, cleanDigits: `33${cleanDigits}`, url: `https://wa.me/33${cleanDigits}` };
        }
      }
    } else if (cc === '33') {
      // France (+33)
      const frMatch = cleanText.match(/(?:(?:\+|00)33[\s.-]?)?(?:0)?([67]\d{1}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})\b/);
      if (frMatch && frMatch[1]) {
        const cleanDigits = frMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 9) {
          return { number: `+33${cleanDigits}`, cleanDigits: `33${cleanDigits}`, url: `https://wa.me/33${cleanDigits}` };
        }
      }
    } else if (cc === '39') {
      // Italy (+39)
      const itMatch = cleanText.match(/(?:(?:\+|00)39[\s.-]?)?(3\d{2}[\s.-]?\d{3}[\s.-]?\d{4})\b/);
      if (itMatch && itMatch[1]) {
        const cleanDigits = itMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 10) {
          return { number: `+39${cleanDigits}`, cleanDigits: `39${cleanDigits}`, url: `https://wa.me/39${cleanDigits}` };
        }
      }
    } else if (cc === '971') {
      const uaeMatch = cleanText.match(/(?:(?:\+|00)971[\s.-]?)?(?:0)?(5[024568][\d\s.-]{7,12})\b/);
      if (uaeMatch && uaeMatch[1]) {
        const cleanDigits = uaeMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 9) {
          return { number: `+971${cleanDigits}`, cleanDigits: `971${cleanDigits}`, url: `https://wa.me/971${cleanDigits}` };
        }
      }
    } else if (cc === '91') {
      const indMatch = cleanText.match(/(?:(?:\+|00)91[\s.-]?)?(?:0)?([6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4})\b/);
      if (indMatch && indMatch[1]) {
        const cleanDigits = indMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 10) {
          return { number: `+91${cleanDigits}`, cleanDigits: `91${cleanDigits}`, url: `https://wa.me/91${cleanDigits}` };
        }
      }
    } else if (cc === '44') {
      const ukMatch = cleanText.match(/(?:(?:\+|00)44[\s.-]?)?(?:0)?(7\d{3}[\s.-]?\d{6})\b/);
      if (ukMatch && ukMatch[1]) {
        const cleanDigits = ukMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 10) {
          return { number: `+44${cleanDigits}`, cleanDigits: `44${cleanDigits}`, url: `https://wa.me/44${cleanDigits}` };
        }
      }
    } else if (cc === '966') {
      const ksaMatch = cleanText.match(/(?:(?:\+|00)966[\s.-]?)?(?:0)?(5\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/);
      if (ksaMatch && ksaMatch[1]) {
        const cleanDigits = ksaMatch[1].replace(/\D/g, '');
        if (cleanDigits.length === 9) {
          return { number: `+966${cleanDigits}`, cleanDigits: `966${cleanDigits}`, url: `https://wa.me/966${cleanDigits}` };
        }
      }
    }
  }

  // NOTE: Generic telephone numbers, office desk landlines ("Tel:", "Phone:", "Call:")
  // without any WhatsApp mention are NEVER returned as WhatsApp leads.
  return null;
};

const isRelevantToKeyword = (title = '', snippet = '', keyword = '') => {
  if (!keyword || typeof keyword !== 'string') return true;
  const kw = keyword.toLowerCase().trim();
  const text = `${title || ''} ${snippet || ''}`.toLowerCase();
  
  // Direct inclusion
  if (text.includes(kw)) return true;

  // Split multi-word keyword
  const words = kw.split(/\s+/).filter(w => w.length >= 3);
  if (words.some(w => text.includes(w))) return true;

  // Domain synonym mapping for common search categories
  const SYNONYMS = {
    dentist: ['dentist', 'dental', 'dentiste', 'dentista', 'odontolog', 'teeth', 'tooth', 'dentaire', 'ortodon', 'orthodont', 'implant', 'стоматолог', 'стоматология', 'зубной', 'зуб', 'zahnarzt'],
    doctor: ['doctor', 'clinic', 'clinique', 'clinica', 'clínica', 'medico', 'médico', 'medical', 'hospital', 'physician', 'santé', 'medecin', 'врач', 'доктор', 'клиника', 'больница', 'медицинский', 'طبيب', 'دكتور'],
    salon: ['salon', 'hair', 'barber', 'coiffure', 'peluqueria', 'peluquería', 'beauty', 'spa', 'esthetique', 'estética', 'onglerie', 'салон', 'парикмахерская', 'красота', 'барбершоп'],
    restaurant: ['restaurant', 'restaurante', 'cafe', 'café', 'bistro', 'bar', 'food', 'dining', 'cuisine', 'ресторан', 'кафе', 'бар', 'пиццерия', 'столовая'],
    hotel: ['hotel', 'resort', 'motel', 'inn', 'stay', 'hospedaje', 'alojamiento', 'lodging', 'отель', 'гостиница', 'хостел'],
    realestate: ['real estate', 'inmobiliaria', 'inmuebles', 'immobilier', 'property', 'realtor', 'broker', 'agency', 'immo', 'недвижимость', 'риелтор', 'квартира'],
    software: ['software', 'tech', 'it company', 'developer', 'it', 'разработка', 'программное', 'ит', 'it-компания', 'web', 'agency', 'technology'],
    lawyer: ['lawyer', 'attorney', 'legal', 'law', 'avocat', 'abogado', 'anwalt', 'юрист', 'адвокат']
  };

  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (kw.includes(key) || syns.some(s => kw.includes(s))) {
      if (syns.some(s => text.includes(s))) return true;
    }
  }

  return words.length === 0;
};

module.exports = { 
  extractEmailFromText, 
  extractSocialLinks, 
  extractMobile, 
  isValidEmailAddress, 
  extractWhatsApp, 
  normalizePhoneNumber,
  detectCountryCode,
  getCountryData,
  isCountryCodeMatch,
  isMobileNumberForCountry,
  isRelevantToKeyword,
  sanitizeSnippetText
};


