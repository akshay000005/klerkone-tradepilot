import crypto from 'node:crypto';
import { env } from '../../config/env.js';

let activeAccessToken = env.FYERS_ACCESS_TOKEN || null;
let tokenExpiryTime = null;

export function getActiveToken() {
  return activeAccessToken;
}

export function setActiveToken(token, expiresInSeconds = 86400) {
  activeAccessToken = token;
  tokenExpiryTime = new Date(Date.now() + expiresInSeconds * 1000);
}

export function isTokenValid() {
  if (!activeAccessToken) return false;
  if (tokenExpiryTime && new Date() >= tokenExpiryTime) return false;
  return true;
}

/**
 * Computes SHA-256 hash of appId:secretKey as required by FYERS API v3
 */
export function generateAppIdHash(appId, secretKey) {
  return crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');
}

/**
 * Builds the official FYERS API v3 OAuth Authorization URL
 */
export function generateFyersAuthUrl({
  appId = env.FYERS_APP_ID,
  redirectUri = env.FYERS_REDIRECT_URI,
  state = 'tradepilot_session',
}) {
  if (!appId) {
    throw new Error('FYERS_APP_ID is not configured in .env');
  }
  const baseUrl = 'https://api-t1.fyers.in/api/v3/generate-authcode';
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Exchanges authorization code received in OAuth callback for an access token
 */
export async function exchangeAuthCodeForToken({
  authCode,
  appId = env.FYERS_APP_ID,
  secretKey = env.FYERS_SECRET_KEY,
}) {
  if (!appId || !secretKey) {
    throw new Error('FYERS_APP_ID and FYERS_SECRET_KEY must be provided');
  }

  const baseAppId = appId.split('-')[0];
  const candidateAppIds = Array.from(new Set([
    appId,
    `${baseAppId}-200`,
    baseAppId,
    `${baseAppId}-100`,
  ]));

  let lastError = null;
  for (const candidate of candidateAppIds) {
    const appIdHash = generateAppIdHash(candidate, secretKey);
    const payload = {
      grant_type: 'authorization_code',
      appIdHash,
      code: authCode,
    };

    try {
      const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.s === 'ok' && data.access_token) {
        setActiveToken(data.access_token);
        return {
          accessToken: data.access_token,
          message: 'FYERS Token generated successfully.',
        };
      }
      lastError = data.message || JSON.stringify(data);
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`FYERS Authentication failed: ${lastError}`);
}
