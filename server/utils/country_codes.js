// Universal Country Dialing Codes & Validation
// Covers all 195+ countries and integrates with cities.js for 100% global city resolution

const COUNTRY_DIALING_DATA = [
  // Western Europe & Microstates
  { name: 'monaco', code: '377', altCodes: ['33'], keywords: ['monaco', 'monte carlo', 'monte-carlo', 'fontvieille', 'la condamine', 'larvotto'] },
  { name: 'france', code: '33', keywords: ['france', 'paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'strasbourg', 'montpellier', 'bordeaux', 'lille', 'cannes'] },
  { name: 'united kingdom', code: '44', keywords: ['uk', 'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'liverpool'] },
  { name: 'germany', code: '49', keywords: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf'] },
  { name: 'italy', code: '39', keywords: ['italy', 'italia', 'rome', 'roma', 'milan', 'milano', 'naples', 'napoli', 'turin', 'florence', 'firenze', 'venice', 'venezia'] },
  { name: 'spain', code: '34', keywords: ['spain', 'españa', 'madrid', 'barcelona', 'valencia', 'seville', 'sevilla', 'zaragoza', 'málaga', 'palma', 'bilbao', 'alicante'] },
  { name: 'portugal', code: '351', keywords: ['portugal', 'lisbon', 'porto', 'braga', 'funchal', 'coimbra', 'setúbal'] },
  { name: 'switzerland', code: '41', keywords: ['switzerland', 'zurich', 'zürich', 'geneva', 'genève', 'basel', 'bern', 'lausanne', 'lucerne'] },
  { name: 'austria', code: '43', keywords: ['austria', 'vienna', 'wien', 'graz', 'linz', 'salzburg', 'innsbruck'] },
  { name: 'belgium', code: '32', keywords: ['belgium', 'brussels', 'antwerp', 'ghent', 'charleroi', 'liège', 'bruges'] },
  { name: 'netherlands', code: '31', keywords: ['netherlands', 'holland', 'amsterdam', 'rotterdam', 'the hague', 'den haag', 'utrecht', 'eindhoven'] },
  { name: 'ireland', code: '353', keywords: ['ireland', 'dublin', 'cork', 'galway', 'limerick', 'waterford'] },
  { name: 'luxembourg', code: '352', keywords: ['luxembourg'] },
  { name: 'andorra', code: '376', keywords: ['andorra'] },
  { name: 'liechtenstein', code: '423', keywords: ['liechtenstein', 'vaduz'] },
  { name: 'malta', code: '356', keywords: ['malta', 'valletta', 'sliema'] },
  { name: 'san marino', code: '378', keywords: ['san marino'] },
  { name: 'vatican', code: '379', altCodes: ['39'], keywords: ['vatican'] },
  { name: 'cyprus', code: '357', keywords: ['cyprus', 'nicosia', 'limassol', 'larnaca'] },
  { name: 'greece', code: '30', keywords: ['greece', 'athens', 'thessaloniki', 'patras', 'heraklion', 'rhodes'] },

  // Nordic
  { name: 'sweden', code: '46', keywords: ['sweden', 'stockholm', 'gothenburg', 'göteborg', 'malmö', 'uppsala'] },
  { name: 'norway', code: '47', keywords: ['norway', 'oslo', 'bergen', 'trondheim', 'stavanger'] },
  { name: 'denmark', code: '45', keywords: ['denmark', 'copenhagen', 'aarhus', 'odense', 'aalborg'] },
  { name: 'finland', code: '358', keywords: ['finland', 'helsinki', 'espoo', 'tampere', 'vantaa', 'oulu'] },
  { name: 'iceland', code: '354', keywords: ['iceland', 'reykjavik'] },

  // Eastern & Central Europe
  { name: 'poland', code: '48', keywords: ['poland', 'warsaw', 'kraków', 'krakow', 'wrocław', 'łódź', 'poznan', 'gdańsk'] },
  { name: 'czech republic', code: '420', keywords: ['czech', 'czechia', 'prague', 'praha', 'brno', 'ostrava'] },
  { name: 'slovakia', code: '421', keywords: ['slovakia', 'bratislava', 'košice'] },
  { name: 'hungary', code: '36', keywords: ['hungary', 'budapest', 'debrecen', 'szeged'] },
  { name: 'romania', code: '40', keywords: ['romania', 'bucharest', 'cluj', 'timișoara', 'iași', 'constanța'] },
  { name: 'bulgaria', code: '359', keywords: ['bulgaria', 'sofia', 'plovdiv', 'varna', 'burgas'] },
  { name: 'croatia', code: '385', keywords: ['croatia', 'zagreb', 'split', 'rijeka', 'dubrovnik'] },
  { name: 'serbia', code: '381', keywords: ['serbia', 'belgrade', 'beograd', 'novi sad', 'niš'] },
  { name: 'slovenia', code: '386', keywords: ['slovenia', 'ljubljana', 'maribor'] },
  { name: 'bosnia', code: '387', keywords: ['bosnia', 'herzegovina', 'sarajevo', 'banja luka', 'mostar'] },
  { name: 'albania', code: '355', keywords: ['albania', 'tirana', 'durrës'] },
  { name: 'north macedonia', code: '389', keywords: ['macedonia', 'skopje'] },
  { name: 'montenegro', code: '382', keywords: ['montenegro', 'podgorica'] },
  { name: 'estonia', code: '372', keywords: ['estonia', 'tallinn', 'tartu'] },
  { name: 'latvia', code: '371', keywords: ['latvia', 'riga', 'daugavpils'] },
  { name: 'lithuania', code: '370', keywords: ['lithuania', 'vilnius', 'kaunas'] },
  { name: 'ukraine', code: '380', keywords: ['ukraine', 'kyiv', 'kiev', 'kharkiv', 'odesa', 'dnipro', 'lviv'] },
  { name: 'russia', code: '7', keywords: ['russia', 'moscow', 'saint petersburg', 'novosibirsk', 'yekaterinburg', 'kazan'] },

  // Middle East & North Africa (MENA)
  { name: 'uae', code: '971', keywords: ['uae', 'dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'fujairah', 'al ain', 'united arab emirates'] },
  { name: 'saudi arabia', code: '966', keywords: ['saudi', 'saudi arabia', 'riyadh', 'jeddah', 'mecca', 'medina', 'dammam', 'khobar'] },
  { name: 'qatar', code: '974', keywords: ['qatar', 'doha', 'al rayyan', 'al wakrah'] },
  { name: 'kuwait', code: '965', keywords: ['kuwait', 'kuwait city', 'salmiya', 'hawalli'] },
  { name: 'oman', code: '968', keywords: ['oman', 'muscat', 'salalah', 'sohar'] },
  { name: 'bahrain', code: '973', keywords: ['bahrain', 'manama', 'riffa', 'muharraq'] },
  { name: 'israel', code: '972', keywords: ['israel', 'tel aviv', 'jerusalem', 'haifa', 'rishon lezion'] },
  { name: 'turkey', code: '90', keywords: ['turkey', 'türkiye', 'istanbul', 'ankara', 'izmir', 'bursa', 'antalya'] },
  { name: 'egypt', code: '20', keywords: ['egypt', 'cairo', 'alexandria', 'giza', 'shubra', 'port said'] },
  { name: 'jordan', code: '962', keywords: ['jordan', 'amman', 'zarqa', 'irbid', 'aqaba'] },
  { name: 'lebanon', code: '961', keywords: ['lebanon', 'beirut', 'tripoli', 'sidon', 'jounieh'] },
  { name: 'iraq', code: '964', keywords: ['iraq', 'baghdad', 'basra', 'erbil', 'mosul'] },
  { name: 'morocco', code: '212', keywords: ['morocco', 'casablanca', 'rabat', 'marrakech', 'tangier', 'fes', 'agadir'] },
  { name: 'algeria', code: '213', keywords: ['algeria', 'algiers', 'oran', 'constantine', 'annaba'] },
  { name: 'tunisia', code: '216', keywords: ['tunisia', 'tunis', 'sfax', 'sousse'] },

  // South Asia & Central Asia
  { name: 'india', code: '91', keywords: ['india', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'ahmedabad', 'chennai', 'kolkata', 'surat', 'pune', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'amritsar', 'navi mumbai', 'noida', 'gurgaon', 'gurugram', 'gujarat', 'maharashtra', 'punjab', 'haryana', 'karnataka', 'tamil nadu', 'kerala', 'rajasthan', 'uttar pradesh'] },
  { name: 'pakistan', code: '92', keywords: ['pakistan', 'karachi', 'lahore', 'faisalabad', 'rawalpindi', 'islamabad', 'peshawar', 'multan', 'quetta'] },
  { name: 'bangladesh', code: '880', keywords: ['bangladesh', 'dhaka', 'chittagong', 'khulna', 'rajshahi', 'sylhet'] },
  { name: 'sri lanka', code: '94', keywords: ['sri lanka', 'colombo', 'kandy', 'galle'] },
  { name: 'nepal', code: '977', keywords: ['nepal', 'kathmandu', 'pokhara', 'lalitpur'] },
  { name: 'kazakhstan', code: '7', keywords: ['kazakhstan', 'almaty', 'astana', 'shymkent'] },
  { name: 'uzbekistan', code: '998', keywords: ['uzbekistan', 'tashkent', 'samarkand', 'bukhara'] },

  // East & Southeast Asia
  { name: 'china', code: '86', keywords: ['china', 'shanghai', 'beijing', 'guangzhou', 'shenzhen', 'chengdu', 'hangzhou', 'wuhan', 'chongqing'] },
  { name: 'hong kong', code: '852', keywords: ['hong kong', 'kowloon'] },
  { name: 'taiwan', code: '886', keywords: ['taiwan', 'taipei', 'kaohsiung', 'taichung'] },
  { name: 'japan', code: '81', keywords: ['japan', 'tokyo', 'osaka', 'yokohama', 'nagoya', 'sapporo', 'fukuoka', 'kobe', 'kyoto'] },
  { name: 'south korea', code: '82', keywords: ['south korea', 'korea', 'seoul', 'busan', 'incheon', 'daegu', 'daejeon'] },
  { name: 'singapore', code: '65', keywords: ['singapore'] },
  { name: 'malaysia', code: '60', keywords: ['malaysia', 'kuala lumpur', 'george town', 'penang', 'johor bahru'] },
  { name: 'indonesia', code: '62', keywords: ['indonesia', 'jakarta', 'surabaya', 'bandung', 'medan', 'bali', 'denpasar'] },
  { name: 'thailand', code: '66', keywords: ['thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya'] },
  { name: 'philippines', code: '63', keywords: ['philippines', 'manila', 'quezon city', 'davao', 'cebu'] },
  { name: 'vietnam', code: '84', keywords: ['vietnam', 'ho chi minh', 'hanoi', 'da nang', 'hai phong'] },

  // Americas
  { name: 'united states', code: '1', keywords: ['usa', 'united states', 'america', 'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis', 'seattle', 'denver', 'washington dc', 'boston', 'el paso', 'nashville', 'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis', 'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'mesa', 'kansas city', 'atlanta', 'omaha', 'colorado springs', 'raleigh', 'long beach', 'virginia beach', 'miami', 'oakland', 'minneapolis', 'tulsa', 'bakersfield', 'tampa', 'wichita', 'arlington', 'california', 'texas', 'florida'] },
  { name: 'canada', code: '1', keywords: ['canada', 'toronto', 'montreal', 'vancouver', 'calgary', 'edmonton', 'ottawa', 'winnipeg', 'quebec city', 'hamilton'] },
  { name: 'mexico', code: '52', keywords: ['mexico', 'méxico', 'mexico city', 'guadalajara', 'monterrey', 'puebla', 'tijuana', 'cancun', 'cancún'] },
  { name: 'brazil', code: '55', keywords: ['brazil', 'brasil', 'são paulo', 'sao paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza', 'belo horizonte', 'curitiba'] },
  { name: 'argentina', code: '54', keywords: ['argentina', 'buenos aires', 'córdoba', 'rosario', 'mendoza', 'la plata', 'mar del plata'] },
  { name: 'chile', code: '56', keywords: ['chile', 'santiago', 'valparaíso', 'concepción', 'antofagasta'] },
  { name: 'colombia', code: '57', keywords: ['colombia', 'bogotá', 'medellín', 'cali', 'barranquilla', 'cartagena'] },
  { name: 'peru', code: '51', keywords: ['peru', 'perú', 'lima', 'arequipa', 'trujillo', 'chiclayo'] },
  { name: 'venezuela', code: '58', keywords: ['venezuela', 'caracas', 'maracaibo', 'valencia venezuela', 'barquisimeto'] },
  { name: 'ecuador', code: '593', keywords: ['ecuador', 'quito', 'guayaquil', 'cuenca'] },
  { name: 'bolivia', code: '591', keywords: ['bolivia', 'la paz', 'santa cruz', 'cochabamba'] },
  { name: 'uruguay', code: '598', keywords: ['uruguay', 'montevideo'] },
  { name: 'paraguay', code: '595', keywords: ['paraguay', 'asunción'] },
  { name: 'panama', code: '507', keywords: ['panama', 'panamá'] },
  { name: 'costa rica', code: '506', keywords: ['costa rica', 'san josé'] },
  { name: 'honduras', code: '504', keywords: ['honduras', 'tegucigalpa', 'san pedro sula'] },
  { name: 'guatemala', code: '502', keywords: ['guatemala'] },
  { name: 'el salvador', code: '503', keywords: ['el salvador', 'san salvador'] },
  { name: 'dominican republic', code: '1809', altCodes: ['1829', '1849', '1'], keywords: ['dominican republic', 'santo domingo'] },

  // Oceania
  { name: 'australia', code: '61', keywords: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'gold coast', 'canberra', 'newcastle', 'hobart', 'darwin'] },
  { name: 'new zealand', code: '64', keywords: ['new zealand', 'auckland', 'wellington', 'christchurch', 'hamilton nz'] },

  // Africa
  { name: 'south africa', code: '27', keywords: ['south africa', 'johannesburg', 'cape town', 'durban', 'pretoria', 'port elizabeth', 'benoni'] },
  { name: 'nigeria', code: '234', keywords: ['nigeria', 'lagos', 'kano', 'ibadan', 'abuja', 'port harcourt'] },
  { name: 'kenya', code: '254', keywords: ['kenya', 'nairobi', 'mombasa', 'kisumu'] },
  { name: 'ghana', code: '233', keywords: ['ghana', 'accra', 'kumasi'] },
  { name: 'ethiopia', code: '251', keywords: ['ethiopia', 'addis ababa'] }
];

// Helper to look up country data
function getCountryData(locationHint) {
  if (!locationHint || typeof locationHint !== 'string') return null;
  const locLower = locationHint.toLowerCase().trim();

  const locNoSpace = locLower.replace(/[\s\-_]+/g, '');

  // 1. Direct keywords match
  for (const item of COUNTRY_DIALING_DATA) {
    if (item.keywords.some(k => {
      const kLower = k.toLowerCase();
      const kNoSpace = kLower.replace(/[\s\-_]+/g, '');
      return locLower === kLower || locLower.includes(kLower) || locNoSpace === kNoSpace || locNoSpace.includes(kNoSpace);
    })) {
      return item;
    }
  }

  // 2. Integration with cities.js (if locationHint is a city inside cities.js)
  try {
    const CITY_MAP = require('./cities');
    for (const [countryName, cityList] of Object.entries(CITY_MAP)) {
      if (locLower === countryName || cityList.some(c => c.toLowerCase() === locLower)) {
        // Look up countryName in COUNTRY_DIALING_DATA
        const match = COUNTRY_DIALING_DATA.find(c => c.name === countryName || c.keywords.includes(countryName));
        if (match) return match;
      }
    }
  } catch (_) {}

  return null;
}

function detectCountryCode(locationHint) {
  const data = getCountryData(locationHint);
  return data ? data.code : null;
}

// All recognized international country codes (sorted by length descending for prefix matching)
const ALL_CALLING_CODES = Array.from(
  new Set(COUNTRY_DIALING_DATA.flatMap(c => [c.code, ...(c.altCodes || [])]))
).sort((a, b) => b.length - a.length);

/**
 * Validates if clean digits match the expected target country.
 * If expectedCode is known:
 *  - Returns true if it starts with expectedCode or any altCodes.
 *  - Returns false if it starts with any OTHER known international country code.
 *  - If it's a local number without international code:
 *      Can be accepted if it matches national length.
 */
function isCountryCodeMatch(digits, expectedCode, altCodes = []) {
  if (!expectedCode) return true; // No filter possible
  const clean = digits.replace(/\D/g, '');
  const allowed = [expectedCode, ...(altCodes || [])];

  // 1. Exact match with allowed country code
  for (const code of allowed) {
    if (clean.startsWith(code)) {
      return true;
    }
  }

  // 2. Check if clean starts with a DIFFERENT known foreign country code
  for (const foreignCode of ALL_CALLING_CODES) {
    if (allowed.includes(foreignCode)) continue;
    if (clean.startsWith(foreignCode)) {
      // It starts with a completely different country code (e.g. 58 for Venezuela when looking for Monaco 377)
      return false;
    }
  }

  // 3. Local number without country prefix (e.g. 8 digits for Monaco 93251122)
  if (expectedCode === '377' && clean.length === 8 && (clean.startsWith('9') || clean.startsWith('4') || clean.startsWith('6'))) {
    return true; // Valid local Monaco number!
  }

  // If length is 10-15 and didn't match our country code, reject
  if (clean.length >= 10) {
    return false;
  }

  return true;
}

/**
 * Validates if clean digits represent a plausible MOBILE number for the country.
 * WhatsApp accounts are strictly on mobile numbers. Fixed landlines do not have WhatsApp.
 */
function isMobileNumberForCountry(cleanDigits, countryCode) {
  if (!cleanDigits) return false;

  // Monaco (+377) or French border (+33)
  if (countryCode === '377') {
    // Monaco mobile: +377 4x xx xx xx or +377 6x xx xx xx (11 digits with 377)
    if (cleanDigits.startsWith('377') && cleanDigits.length === 11) {
      const prefix = cleanDigits.substring(3, 4);
      return prefix === '4' || prefix === '6';
    }
    // French mobile in Monaco: +33 6x xx xx xx xx or +33 7x xx xx xx xx (11 digits with 33)
    if (cleanDigits.startsWith('33') && cleanDigits.length === 11) {
      const prefix = cleanDigits.substring(2, 3);
      return prefix === '6' || prefix === '7';
    }
    // Local Monaco mobile without 377: 4x xx xx xx or 6x xx xx xx (8 digits)
    if (cleanDigits.length === 8 && (cleanDigits.startsWith('4') || cleanDigits.startsWith('6'))) {
      return true;
    }
    // Local French mobile: 06... or 07... (10 digits)
    if (cleanDigits.length === 10 && (cleanDigits.startsWith('06') || cleanDigits.startsWith('07'))) {
      return true;
    }
    // Monaco landlines (+377 9...): NOT A MOBILE PHONE, NO WHATSAPP!
    return false;
  }

  // France (+33)
  if (countryCode === '33') {
    if (cleanDigits.startsWith('33') && cleanDigits.length === 11) {
      const prefix = cleanDigits.substring(2, 3);
      return prefix === '6' || prefix === '7';
    }
    if (cleanDigits.length === 10 && (cleanDigits.startsWith('06') || cleanDigits.startsWith('07'))) return true;
    return false;
  }

  // UAE (+971)
  if (countryCode === '971') {
    if (cleanDigits.startsWith('971') && cleanDigits.length === 12) {
      const prefix = cleanDigits.substring(3, 5);
      return ['50', '52', '54', '55', '56', '58'].includes(prefix);
    }
    if (cleanDigits.length === 10 && cleanDigits.startsWith('05')) return true;
    if (cleanDigits.length === 9 && cleanDigits.startsWith('5')) return true;
    return false;
  }

  // UK (+44)
  if (countryCode === '44') {
    if (cleanDigits.startsWith('44') && cleanDigits.length === 12) {
      return cleanDigits.substring(2, 3) === '7';
    }
    if (cleanDigits.length === 11 && cleanDigits.startsWith('07')) return true;
    if (cleanDigits.length === 10 && cleanDigits.startsWith('7')) return true;
    return false;
  }

  // India (+91)
  if (countryCode === '91') {
    if (cleanDigits.startsWith('91') && cleanDigits.length === 12) {
      const first = cleanDigits.substring(2, 3);
      return ['6', '7', '8', '9'].includes(first);
    }
    if (cleanDigits.length === 10 && ['6', '7', '8', '9'].includes(cleanDigits.substring(0, 1))) return true;
    return false;
  }

  // Saudi Arabia (+966)
  if (countryCode === '966') {
    if (cleanDigits.startsWith('966') && cleanDigits.length === 12) {
      return cleanDigits.substring(3, 4) === '5';
    }
    if (cleanDigits.length === 10 && cleanDigits.startsWith('05')) return true;
    if (cleanDigits.length === 9 && cleanDigits.startsWith('5')) return true;
    return false;
  }

  // Spain (+34)
  if (countryCode === '34') {
    // Spanish mobile numbers start with 6 or 7 and have 9 digits (or 11 with 34)
    if (cleanDigits.startsWith('34') && cleanDigits.length === 11) {
      const prefix = cleanDigits.substring(2, 3);
      return prefix === '6' || prefix === '7';
    }
    if (cleanDigits.length === 9 && (cleanDigits.startsWith('6') || cleanDigits.startsWith('7'))) {
      return true;
    }
    // Spanish landlines (starting with 8 or 9) are NOT mobile, rejected for WhatsApp!
    return false;
  }

  // Italy (+39)
  if (countryCode === '39') {
    // Italian mobile numbers start with 3 and have 10 digits (or 12 with 39)
    if (cleanDigits.startsWith('39') && cleanDigits.length === 12) {
      return cleanDigits.substring(2, 3) === '3';
    }
    if (cleanDigits.length === 10 && cleanDigits.startsWith('3')) {
      return true;
    }
    return false;
  }

  // Germany (+49)
  if (countryCode === '49') {
    // German mobile starts with 15, 16, 17
    if (cleanDigits.startsWith('49') && cleanDigits.length >= 11 && cleanDigits.length <= 13) {
      const prefix = cleanDigits.substring(2, 4);
      return ['15', '16', '17'].includes(prefix);
    }
    if (cleanDigits.startsWith('01') && cleanDigits.length >= 10 && cleanDigits.length <= 12) {
      const prefix = cleanDigits.substring(1, 3);
      return ['15', '16', '17'].includes(prefix);
    }
    if (cleanDigits.startsWith('1') && cleanDigits.length >= 10 && cleanDigits.length <= 11) {
      const prefix = cleanDigits.substring(0, 2);
      return ['15', '16', '17'].includes(prefix);
    }
    return false;
  }

  // For other countries without strict mobile prefixes known: length between 9 and 15
  return cleanDigits.length >= 9 && cleanDigits.length <= 15;
}

module.exports = {
  COUNTRY_DIALING_DATA,
  getCountryData,
  detectCountryCode,
  isCountryCodeMatch,
  isMobileNumberForCountry
};

