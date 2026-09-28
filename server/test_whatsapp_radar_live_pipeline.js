const http = require('http');
const assert = require('assert');
const { crawlWebsiteForWhatsApp } = require('./utils/whatsapp_crawler');
const { extractWhatsApp, normalizePhoneNumber } = require('./utils/email_extractor');

console.log('=== RUNNING WHATSAPP RADAR LIVE PIPELINE REGRESSION SUITE ===\n');

let passed = 0;
let failed = 0;

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`[PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failed++;
  }
}

// Spin up a mock local HTTP server to simulate various website responses
let mockServer;
let mockPort = 9876;
const responses = new Map();

function setupMockServer() {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      const url = req.url;
      const handler = responses.get(url);
      if (handler) {
        handler(req, res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    mockServer.listen(mockPort, () => {
      resolve();
    });
  });
}

function teardownMockServer() {
  return new Promise((resolve) => {
    if (mockServer) {
      mockServer.close(resolve);
    } else {
      resolve();
    }
  });
}

async function runAllTests() {
  await setupMockServer();

  // 1. Google Places phone only → NOT WhatsApp
  await runTest('1. Google Places phone only → NOT WhatsApp', async () => {
    const rawGooglePlacePhone = '+44 20 7946 0919'; // London landline or standard phone from Google Places
    const placeName = 'Acme Marketing Agency';
    const placeAddress = '10 Downing St, London, UK';
    const locHint = 'London, UK ' + placeAddress;

    // Direct check: Passing only Google Places phone without WhatsApp evidence must return null
    const waData = extractWhatsApp(rawGooglePlacePhone, placeName, '', locHint);
    assert.strictEqual(waData, null, 'Google Places phone alone must NEVER be treated as WhatsApp number');

    // Also verify that even a mobile number from Google Places without WhatsApp evidence is NOT WhatsApp
    const rawMobileGooglePlacePhone = '+44 7911 123456';
    const waDataMobile = extractWhatsApp(rawMobileGooglePlacePhone, placeName, '', locHint);
    assert.strictEqual(waDataMobile, null, 'Google Places mobile alone without WhatsApp evidence must NOT be treated as WhatsApp lead');
  });

  // 2. Website contains genuine wa.me → WhatsApp lead
  await runTest('2. Website contains genuine wa.me → WhatsApp lead', async () => {
    responses.set('/site-wa', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Great Digital Agency</title></head>
          <body>
            <h1>Welcome to Great Digital Agency</h1>
            <p>Chat with us on our direct WhatsApp chat line!</p>
            <a href="https://wa.me/447476835182" class="wa-btn">Chat with Us</a>
          </body>
        </html>
      `);
    });

    const result = await crawlWebsiteForWhatsApp(
      `http://127.0.0.1:${mockPort}/site-wa`,
      'Great Digital Agency',
      'London, UK'
    );

    assert(result !== null, 'Expected verified WhatsApp lead');
    assert.strictEqual(result.number, '+447476835182');
    assert.strictEqual(result.cleanDigits, '447476835182');
    assert.strictEqual(result.url, 'https://wa.me/447476835182');
  });

  // 3. Website contains no WhatsApp evidence → reject
  await runTest('3. Website contains no WhatsApp evidence → reject', async () => {
    responses.set('/site-no-wa', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Corporate Agency</title></head>
          <body>
            <h1>Welcome to Corporate Agency</h1>
            <p>Contact our support team at office@corporate.co.uk or call 020 7946 0000.</p>
          </body>
        </html>
      `);
    });

    const result = await crawlWebsiteForWhatsApp(
      `http://127.0.0.1:${mockPort}/site-no-wa`,
      'Corporate Agency',
      'London, UK'
    );

    assert.strictEqual(result, null, 'Website without WhatsApp evidence must return null');
  });

  // 4. 10 businesses / 2 genuine WhatsApp → exactly 2 leads
  await runTest('4. 10 businesses / 2 genuine WhatsApp → exactly 2 leads', async () => {
    // Setup 10 mock sites: 2 with authentic wa.me, 8 with no WhatsApp evidence
    for (let i = 1; i <= 10; i++) {
      if (i === 3) {
        responses.set(`/biz-${i}`, (req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<a href="https://wa.me/447700900077">WhatsApp Support</a>');
        });
      } else if (i === 7) {
        responses.set(`/biz-${i}`, (req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<a href="https://api.whatsapp.com/send?phone=447700900088">Contact via WhatsApp</a>');
        });
      } else {
        responses.set(`/biz-${i}`, (req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Standard Business</h1><p>Call us at 020 7123 4567</p>');
        });
      }
    }

    const mockPlaces = Array.from({ length: 10 }, (_, idx) => {
      const id = idx + 1;
      return {
        id: `place_${id}`,
        displayName: { text: `Business ${id}` },
        formattedAddress: `Address ${id}, London, UK`,
        nationalPhoneNumber: `020 7946 000${id}`,
        websiteUri: `http://127.0.0.1:${mockPort}/biz-${id}`
      };
    });

    // Run parallel crawl logic (same as live server/index.js)
    const candidates = mockPlaces.filter(p => p.websiteUri);
    const crawlResults = await Promise.all(
      candidates.map(async (place) => {
        const waData = await crawlWebsiteForWhatsApp(
          place.websiteUri,
          place.displayName.text,
          'London, UK ' + place.formattedAddress,
          { timeoutMs: 2000 }
        );
        return { place, waData };
      })
    );

    const verifiedLeads = crawlResults.filter(r => r.waData !== null);
    assert.strictEqual(verifiedLeads.length, 2, `Expected exactly 2 leads, got ${verifiedLeads.length}`);
    assert.strictEqual(verifiedLeads[0].waData.number, '+447700900077');
    assert.strictEqual(verifiedLeads[1].waData.number, '+447700900088');
  });

  // 5. 10 businesses / 0 genuine WhatsApp → 0 leads
  await runTest('5. 10 businesses / 0 genuine WhatsApp → 0 leads', async () => {
    for (let i = 1; i <= 10; i++) {
      responses.set(`/no-wa-${i}`, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Company ${i}</h1><p>Email: contact@company${i}.com</p>`);
      });
    }

    const mockPlaces = Array.from({ length: 10 }, (_, idx) => {
      const id = idx + 1;
      return {
        id: `place_nowa_${id}`,
        displayName: { text: `Company ${id}` },
        formattedAddress: `Street ${id}, London, UK`,
        nationalPhoneNumber: `020 7946 111${id}`,
        websiteUri: `http://127.0.0.1:${mockPort}/no-wa-${id}`
      };
    });

    const crawlResults = await Promise.all(
      mockPlaces.map(async (place) => {
        const waData = await crawlWebsiteForWhatsApp(
          place.websiteUri,
          place.displayName.text,
          'London, UK ' + place.formattedAddress,
          { timeoutMs: 2000 }
        );
        return { place, waData };
      })
    );

    const verifiedLeads = crawlResults.filter(r => r.waData !== null);
    assert.strictEqual(verifiedLeads.length, 0, `Expected 0 leads, got ${verifiedLeads.length}`);
  });

  // 6. Duplicate WhatsApp numbers → one lead
  await runTest('6. Duplicate WhatsApp numbers → deduplicated to one lead', async () => {
    // Two different businesses with the same shared agency WhatsApp number
    responses.set('/site-dup-1', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<a href="https://wa.me/447700999999">Chat on WhatsApp</a>');
    });
    responses.set('/site-dup-2', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<a href="https://wa.me/447700999999">Chat on WhatsApp</a>');
    });

    const sites = [
      { id: 'p1', name: 'Brand A', website: `http://127.0.0.1:${mockPort}/site-dup-1` },
      { id: 'p2', name: 'Brand B', website: `http://127.0.0.1:${mockPort}/site-dup-2` }
    ];

    const seenPhoneNumbers = new Set();
    const insertedLeads = [];

    for (const site of sites) {
      const waData = await crawlWebsiteForWhatsApp(site.website, site.name, 'London, UK');
      if (waData) {
        if (!seenPhoneNumbers.has(waData.cleanDigits)) {
          seenPhoneNumbers.add(waData.cleanDigits);
          insertedLeads.push({ site, waData });
        }
      }
    }

    assert.strictEqual(insertedLeads.length, 1, `Expected deduplication to 1 lead, got ${insertedLeads.length}`);
    assert.strictEqual(insertedLeads[0].waData.number, '+447700999999');
  });

  // 7. Slow/unreachable website → job continues without blocking indefinitely
  await runTest('7. Slow/unreachable website → job continues without blocking indefinitely', async () => {
    // 1 slow hanging response (takes 10s)
    responses.set('/site-slow', (req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Eventually responded</h1>');
      }, 10000);
    });

    // 1 fast response with WhatsApp
    responses.set('/site-fast', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<a href="https://wa.me/447700911222">Chat with fast site</a>');
    });

    const startTime = Date.now();
    const sites = [
      { id: 'slow', website: `http://127.0.0.1:${mockPort}/site-slow` },
      { id: 'fast', website: `http://127.0.0.1:${mockPort}/site-fast` },
      { id: 'dead', website: 'http://192.0.2.1:8888/dead-network' } // Non-routable IP (RFC 5737)
    ];

    const results = await Promise.all(
      sites.map(async (site) => {
        const waData = await crawlWebsiteForWhatsApp(site.website, 'Site', 'London, UK', { timeoutMs: 1500 });
        return { site, waData };
      })
    );

    const elapsed = Date.now() - startTime;
    console.log(`   (Slow site handled in ${elapsed}ms)`);

    assert(elapsed < 4000, `Expected parallel crawl to finish within 4s, took ${elapsed}ms`);
    const valid = results.filter(r => r.waData !== null);
    assert.strictEqual(valid.length, 1, 'Only fast site with valid wa.me should succeed');
    assert.strictEqual(valid[0].waData.number, '+447700911222');
  });

  // 8. Existing WARD1 false-positive behavior remains permanently blocked
  await runTest('8. Existing WARD1 false-positive behavior remains permanently blocked', async () => {
    // WARD1 Bug A: Synthesizing 'WhatsApp: ' + rawGooglePlacesPhone
    const syntheticTag = 'WhatsApp: 020 7946 0919'; // Landline prepended with WhatsApp
    const resA = extractWhatsApp(syntheticTag, 'Fake WA Agency', '', 'London, UK');
    assert.strictEqual(resA, null, 'Synthetic WhatsApp label with landline must be blocked');

    // WARD1 Bug B: Snippet guessing where "whatsapp" is unrelated to phone
    const unrelatedSnippet = 'We provide Facebook Ads, SEO, and WhatsApp marketing campaigns. Call us today on +44 20 7946 0000.';
    const resB = extractWhatsApp(unrelatedSnippet, 'Marketing Co', 'https://mkt.co.uk', 'London, UK');
    assert.strictEqual(resB, null, 'Unrelated WhatsApp mention with landline must be blocked');

    // WARD1 Bug C: wa.me with a landline number
    const landlineWaUrl = 'https://wa.me/442079460919';
    const resC = extractWhatsApp('', 'Landline Co', landlineWaUrl, 'London, UK');
    assert.strictEqual(resC, null, 'wa.me pointing to landlines must be blocked');

    // WARD1 Bug D: Facebook post ID / photo ID / URL slug containing digits
    const fbSlug = 'facebook.com/agency/posts/10158392817291028 whatsapp promo';
    const resD = extractWhatsApp(fbSlug, 'Agency', '', 'London, UK');
    assert.strictEqual(resD, null, 'URL slug / post ID digits must be blocked');
  });

  await teardownMockServer();

  console.log(`\n======================================================`);
  console.log(`REGRESSION RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite runner crashed:', err);
  if (mockServer) mockServer.close();
  process.exit(1);
});
