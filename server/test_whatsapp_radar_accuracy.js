const assert = require('assert');
const { extractWhatsApp, normalizePhoneNumber } = require('./utils/email_extractor');

console.log('--- RUNNING WHATSAPP RADAR ACCURACY REGRESSION SUITE ---\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// Test 1: wa.me direct mobile link
test('1. Direct wa.me URL with UK mobile extracts verified WhatsApp data', () => {
  const result = extractWhatsApp('', 'My Agency', 'https://wa.me/447476835182', 'London, UK');
  assert(result !== null, 'Expected result to be non-null');
  assert.strictEqual(result.number, '+447476835182');
  assert.strictEqual(result.cleanDigits, '447476835182');
  assert.strictEqual(result.url, 'https://wa.me/447476835182');
});

// Test 2: api.whatsapp.com encoded link
test('2. Direct api.whatsapp.com encoded phone link extracts verified WhatsApp data', () => {
  const result = extractWhatsApp('', 'My Agency', 'https://api.whatsapp.com/send?phone=%2B447988582665&text=Hello', 'London, UK');
  assert(result !== null, 'Expected result to be non-null');
  assert.strictEqual(result.number, '+447988582665');
  assert.strictEqual(result.cleanDigits, '447988582665');
  assert.strictEqual(result.url, 'https://wa.me/447988582665');
});

// Test 3: Explicit WhatsApp label in text (Label before number)
test('3. Explicit WhatsApp label in snippet (WhatsApp: +44 7...) extracts verified lead', () => {
  const snippet = 'Contact our London creative team today on WhatsApp: +44 7526 763227 for immediate support.';
  const result = extractWhatsApp(snippet, 'Sircol SEO', '', 'London, UK');
  assert(result !== null, 'Expected result to be non-null');
  assert.strictEqual(result.number, '+447526763227');
  assert.strictEqual(result.url, 'https://wa.me/447526763227');
});

// Test 4: Explicit WhatsApp label in text (Number before label)
test('4. Explicit WhatsApp label in snippet (07526 763227 - WhatsApp) extracts verified lead', () => {
  const snippet = 'Call us or message 07526 763227 (WhatsApp) for a free marketing consultation.';
  const result = extractWhatsApp(snippet, 'Sircol SEO', '', 'London, UK');
  assert(result !== null, 'Expected result to be non-null');
  assert.strictEqual(result.number, '+447526763227');
});

// Test 5: Plain landline without WhatsApp evidence -> MUST BE REJECTED
test('5. London office landline (020 7946 0123) without WhatsApp evidence is strictly rejected', () => {
  const snippet = 'Visit our Central London office at Oxford Street. Call us on 020 7946 0123 or email info@agency.co.uk';
  const result = extractWhatsApp(snippet, 'Standard Agency', 'https://standardagency.co.uk', 'London, UK');
  assert.strictEqual(result, null, 'Plain landline should return null');
});

// Test 6: wa.me pointing to a landline -> MUST BE REJECTED (requireMobile strictly enforced)
test('6. wa.me link with London landline (020 7946 0123) is strictly rejected', () => {
  const result = extractWhatsApp('', 'Landline Agency', 'https://wa.me/442079460123', 'London, UK');
  assert.strictEqual(result, null, 'Landline wa.me should be rejected by requireMobile');
});

// Test 7: Rule 4 snippet contamination removal -> MUST BE REJECTED
test('7. Mobile number in text where "whatsapp" is unrelated/separated is strictly rejected', () => {
  // In WARD1, if snippet had "whatsapp" anywhere (e.g. mentioning we do whatsapp marketing) and a mobile number,
  // it misclassified the number as a WhatsApp lead. In WARD2, this is strictly rejected.
  const snippet = 'We offer comprehensive social media, email and WhatsApp marketing services. Call our office mobile at +44 7400 123456.';
  // Note: "+44 7400 123456" is separated from "WhatsApp" by sentences/clauses and is labelled "office mobile"
  const result = extractWhatsApp(snippet, 'Social Agency', 'https://socialagency.co.uk', 'London, UK');
  assert.strictEqual(result, null, 'Unassociated mobile number must not be tagged as WhatsApp');
});

// Test 8: Random search breadcrumb or Facebook post ID -> MUST BE REJECTED
test('8. Facebook post ID or breadcrumb digits are sanitized and not parsed as WhatsApp', () => {
  const snippet = 'View our latest case study on facebook.com/marketingagency/posts/10158947291847291 with whatsapp updates.';
  const result = extractWhatsApp(snippet, 'FB Agency', '', 'London, UK');
  assert.strictEqual(result, null, 'Sanitization should strip URL paths before regex matching');
});

// Test 9: International Mobile normalization (Spain, India, UAE, France, Saudi)
test('9. International mobile validation handles multiple target countries correctly', () => {
  // Spain mobile (+34 6...)
  const es = extractWhatsApp('', 'Madrid Agency', 'https://wa.me/34689332520', 'Madrid, Spain');
  assert(es !== null && es.number === '+34689332520', 'Spain mobile should pass');

  // India mobile (+91 9...)
  const inMob = extractWhatsApp('', 'Mumbai Agency', 'https://wa.me/919820123456', 'Mumbai, India');
  assert(inMob !== null && inMob.number === '+919820123456', 'India mobile should pass');

  // UAE mobile (+971 5...)
  const uae = extractWhatsApp('', 'Dubai Agency', 'https://wa.me/971501234567', 'Dubai, UAE');
  assert(uae !== null && uae.number === '+971501234567', 'UAE mobile should pass');
});

// Test 10: Zero valid leads returns clean null / empty
test('10. Completely empty, invalid or unrelated business returns null', () => {
  const emptyRes = extractWhatsApp('', 'Unknown', '', 'London, UK');
  assert.strictEqual(emptyRes, null);

  const nonWaRes = extractWhatsApp('Best digital marketing solutions in London since 2010. High ROI campaigns.', 'Alpha Ltd', 'https://alpha.co.uk', 'London, UK');
  assert.strictEqual(nonWaRes, null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL WHATSAPP RADAR ACCURACY TESTS PASSED!\n');
}
