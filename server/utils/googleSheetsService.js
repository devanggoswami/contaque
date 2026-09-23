/**
 * ==============================================================================
 * Google Sheets User Sync Service
 * ==============================================================================
 * Asynchronously syncs user signup and profile records to a Google Sheet.
 * 
 * Non-Breaking & Fault-Tolerant:
 * - Runs asynchronously in background after successful PostgreSQL insertion.
 * - If Google Sheets API is unconfigured or fails, signup/login still succeeds 100%.
 * - Uses PostgreSQL user ID as unique key to prevent duplicate rows.
 * - Supports Service Account credentials (env vars or JSON file) and Apps Script Webhooks.
 * ==============================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// In-memory token cache to avoid requesting a new token for every single signup
let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Base64 URL Encoder
 */
function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Load Google Service Account and Sheet Configuration from Environment
 */
function getSheetsConfig() {
  const spreadsheetId = (
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 
    process.env.GOOGLE_SHEET_ID || 
    ''
  ).trim();

  const sheetName = (
    process.env.GOOGLE_SHEETS_SHEET_NAME || 
    process.env.GOOGLE_SHEET_NAME || 
    'Users'
  ).trim();

  const webhookUrl = (
    process.env.GOOGLE_SHEETS_WEBHOOK_URL || 
    ''
  ).trim();

  let clientEmail = (
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL || 
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 
    ''
  ).trim();

  let privateKey = (
    process.env.GOOGLE_SHEETS_PRIVATE_KEY || 
    process.env.GOOGLE_PRIVATE_KEY || 
    ''
  ).trim();

  // Option 1: Load from raw JSON string in env
  const rawJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson && (!clientEmail || !privateKey)) {
    try {
      const parsed = JSON.parse(rawJson);
      clientEmail = clientEmail || parsed.client_email || '';
      privateKey = privateKey || parsed.private_key || '';
    } catch (e) {
      console.warn('[Google Sheets Sync] Could not parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  // Option 2: Load from JSON key file path
  const keyFilePath = (
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 
    process.env.GOOGLE_APPLICATION_CREDENTIALS || 
    ''
  ).trim();

  if (keyFilePath && (!clientEmail || !privateKey)) {
    try {
      const resolvedPath = path.isAbsolute(keyFilePath) 
        ? keyFilePath 
        : path.resolve(__dirname, '..', keyFilePath);

      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        clientEmail = clientEmail || parsed.client_email || '';
        privateKey = privateKey || parsed.private_key || '';
      }
    } catch (fErr) {
      console.warn('[Google Sheets Sync] Could not read service account key file:', fErr.message);
    }
  }

  // Sanitize private key: handle escaped \n in env strings and outer quotes
  if (privateKey) {
    privateKey = privateKey
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n');
  }

  const isServiceAccountConfigured = Boolean(spreadsheetId && clientEmail && privateKey);
  const isWebhookConfigured = Boolean(webhookUrl);
  const isConfigured = isServiceAccountConfigured || isWebhookConfigured;

  return {
    isConfigured,
    isServiceAccountConfigured,
    isWebhookConfigured,
    spreadsheetId,
    sheetName,
    clientEmail,
    privateKey,
    webhookUrl,
    targetOwnerEmail: 'madmandg17@gmail.com'
  };
}

/**
 * Generate Google OAuth2 Access Token using Service Account JWT
 */
async function getGoogleAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (buffer of 60 seconds)
  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: config.clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signInput = `${encodedHeader}.${encodedClaims}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signature = signer.sign(config.privateKey, 'base64url');
  const jwt = `${signInput}.${signature}`;

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('assertion', jwt);

  const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  if (!response.data || !response.data.access_token) {
    throw new Error('Google OAuth2 token endpoint returned empty access token');
  }

  cachedAccessToken = response.data.access_token;
  tokenExpiresAt = now + (response.data.expires_in || 3600);

  return cachedAccessToken;
}

/**
 * Standard Sheet Headers
 */
const DEFAULT_HEADERS = [
  'User ID',
  'Name',
  'Email',
  'Signup Date',
  'Signup Method',
  'Current Plan',
  'Email Verified',
  'Payment Status',
  'Last Synced'
];

/**
 * Ensure sheet headers exist in row 1
 */
async function ensureSheetHeaders(accessToken, config) {
  try {
    const range = `${encodeURIComponent(config.sheetName)}!A1:I1`;
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}`;

    const checkRes = await axios.get(checkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    });

    const rows = checkRes.data.values || [];
    if (rows.length === 0 || rows[0].length === 0) {
      // Row 1 is empty, initialize headers
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
      await axios.put(
        updateUrl,
        { values: [DEFAULT_HEADERS] },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      console.log(`[Google Sheets Sync] Initialized column headers in sheet "${config.sheetName}"`);
    }
  } catch (err) {
    // If sheet tab name doesn't exist yet, try to fallback to first sheet or log warning
    console.warn(`[Google Sheets Sync] Header check note:`, err.response?.data?.error?.message || err.message);
  }
}

/**
 * Helper to format date strictly in Indian Standard Time (IST)
 */
function formatIST(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase() + ' IST';
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Format user row data array with IST timestamps
 */
function formatUserRow(user) {
  const userId = user.id !== undefined && user.id !== null ? String(user.id) : '';
  const name = (user.name || user.email?.split('@')[0] || 'User').trim();
  const email = (user.email || '').trim().toLowerCase();
  
  const signupDate = user.created_at ? formatIST(user.created_at) : formatIST(new Date());
  const signupMethod = (user.auth_provider || 'local').toLowerCase();
  const currentPlan = (user.plan || 'free').toLowerCase();
  const emailVerified = user.email_verified ? 'Yes' : 'No';
  const paymentStatus = user.payment_status || (currentPlan === 'plus' || currentPlan === 'pack' ? 'ACTIVE' : 'FREE');
  const lastSynced = formatIST(new Date());

  return [
    userId,
    name,
    email,
    signupDate,
    signupMethod,
    currentPlan,
    emailVerified,
    paymentStatus,
    lastSynced
  ];
}

/**
 * Main Sync Function: Add or update a user record in Google Sheets
 * 
 * @param {Object} user - User data object from PostgreSQL
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function syncUserToGoogleSheets(user) {
  if (!user || !user.email) {
    return { success: false, error: 'Invalid user payload: email is required' };
  }

  const config = getSheetsConfig();

  // If Google Sheets integration is not configured, silently skip without error
  if (!config.isConfigured) {
    return {
      success: true,
      skipped: true,
      message: 'Google Sheets sync skipped (GOOGLE_SHEETS_SPREADSHEET_ID or credentials not configured)'
    };
  }

  try {
    const rowValues = formatUserRow(user);

    // Method 1: Google Apps Script Webhook (if configured)
    if (config.isWebhookConfigured) {
      const webhookRes = await axios.post(
        config.webhookUrl,
        {
          action: 'sync_user',
          user: {
            id: rowValues[0],
            name: rowValues[1],
            email: rowValues[2],
            signup_date: rowValues[3],
            signup_method: rowValues[4],
            plan: rowValues[5],
            email_verified: rowValues[6],
            payment_status: rowValues[7],
            last_synced: rowValues[8]
          },
          rowData: rowValues
        },
        { timeout: 10000 }
      );

      console.log(`[Google Sheets Sync:Webhook] Synced user ${user.email} successfully.`);
      return { success: true, method: 'webhook', data: webhookRes.data };
    }

    // Method 2: Google Sheets API v4 with Service Account
    const accessToken = await getGoogleAccessToken(config);
    await ensureSheetHeaders(accessToken, config);

    const sheetRange = `${encodeURIComponent(config.sheetName)}!A:C`;
    const searchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${sheetRange}`;

    // 1. Check for existing row to prevent duplicates (match by User ID or Email)
    let existingRowIndex = -1;
    try {
      const getRes = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
      });

      const rows = getRes.data.values || [];
      const targetUserId = String(user.id || '').trim();
      const targetEmail = String(user.email || '').trim().toLowerCase();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowUserId = row[0] ? String(row[0]).trim() : '';
        const rowEmail = row[2] ? String(row[2]).trim().toLowerCase() : '';

        if ((targetUserId && rowUserId === targetUserId) || (targetEmail && rowEmail === targetEmail)) {
          existingRowIndex = i + 1; // 1-indexed row number in Google Sheets
          break;
        }
      }
    } catch (findErr) {
      console.warn('[Google Sheets Sync] Could not search existing rows, proceeding to append:', findErr.message);
    }

    if (existingRowIndex > 1) {
      // 2. Update existing row
      const updateRange = `${encodeURIComponent(config.sheetName)}!A${existingRowIndex}:I${existingRowIndex}`;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`;

      await axios.put(
        updateUrl,
        { values: [rowValues] },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`[Google Sheets Sync] Updated existing row ${existingRowIndex} for user ${user.email} (ID: ${user.id})`);
      return { success: true, action: 'updated', row: existingRowIndex };
    } else {
      // 3. Append new row
      const appendRange = `${encodeURIComponent(config.sheetName)}!A:I`;
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      const appendRes = await axios.post(
        appendUrl,
        { values: [rowValues] },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const updatedRange = appendRes.data?.updates?.updatedRange || 'Sheet1';
      console.log(`[Google Sheets Sync] Appended user ${user.email} (ID: ${user.id}) -> ${updatedRange}`);
      return { success: true, action: 'appended', range: updatedRange };
    }
  } catch (err) {
    const errorDetails = err.response?.data?.error?.message || err.message;
    console.error(`[Google Sheets Sync Error] Failed to sync user ${user.email}:`, errorDetails);
    return { success: false, error: errorDetails };
  }
}

/**
 * Diagnostic Connection Test Helper
 */
async function testGoogleSheetsConnection() {
  const config = getSheetsConfig();
  console.log('--- Google Sheets Configuration Diagnostic ---');
  console.log('Configured:', config.isConfigured);
  console.log('Spreadsheet ID:', config.spreadsheetId ? `${config.spreadsheetId.slice(0, 8)}...` : 'NOT SET');
  console.log('Sheet Name:', config.sheetName);
  console.log('Client Email:', config.clientEmail || 'NOT SET');
  console.log('Private Key Present:', Boolean(config.privateKey));
  console.log('Target Owner Gmail:', config.targetOwnerEmail);

  if (!config.isConfigured) {
    return {
      success: false,
      message: 'Google Sheets sync is not configured. Add GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_CLIENT_EMAIL, and GOOGLE_SHEETS_PRIVATE_KEY to server/.env'
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(config);
    await ensureSheetHeaders(accessToken, config);
    return {
      success: true,
      message: `Successfully connected to Google Sheet "${config.sheetName}" in Spreadsheet ID ${config.spreadsheetId}`
    };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return {
      success: false,
      error: msg
    };
  }
}

module.exports = {
  syncUserToGoogleSheets,
  testGoogleSheetsConnection,
  getSheetsConfig
};
