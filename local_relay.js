import http from 'node:http';
import { exchangeAuthCodeForToken } from './backend/src/broker/fyers/auth.js';

const PORT = 5000;
const CLOUD_URL = 'https://klerkone-tradepilot.onrender.com';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname === '/api/v1/broker/fyers/callback') {
    const authCode = url.searchParams.get('auth_code') || url.searchParams.get('code');
    
    if (!authCode) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h3>Authorization code missing. Please try again.</h3>');
      return;
    }

    try {
      // 1. Exchange auth code for token
      const result = await exchangeAuthCodeForToken({ authCode });
      const token = result.accessToken;

      // 2. Relay token to Render cloud server
      try {
        await fetch(`${CLOUD_URL}/api/v1/broker/fyers/manual-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (err) {
        console.error('Failed to relay token to cloud:', err.message);
      }

      // 3. Return success HTML to user browser
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>FYERS Connected</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #fff; text-align: center; padding-top: 50px; }
              .card { max-width: 420px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
              .icon { font-size: 48px; margin-bottom: 16px; }
              h2 { font-size: 20px; font-weight: 700; color: #10b981; margin: 0 0 8px; }
              p { font-size: 13px; color: #9ca3af; margin: 0 0 24px; line-height: 1.5; }
              .btn { display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✅</div>
              <h2>FYERS Connected Successfully!</h2>
              <p>Your session has been validated and synced with KlerkOne TradePilot Cloud.</p>
              <a href="${CLOUD_URL}" class="btn" onclick="window.close();">Close Window & Return</a>
            </div>
            <script>
              try {
                if (window.opener) {
                  window.opener.location.reload();
                  setTimeout(() => window.close(), 1800);
                }
              } catch(e) {}
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family: sans-serif; background: #0b0f19; color: #f43f5e; padding: 40px; text-align: center;">
          <h2>Authentication Error</h2>
          <p style="color: #9ca3af;">${err.message}</p>
          <p style="color: #6366f1; font-size: 12px;">Auth codes expire in 2-3 minutes. Please try again.</p>
        </div>
      `);
    }
    return;
  }

  // Health check for port 5000
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'UP', service: 'TradePilot Local Relay Bridge' }));
});

server.listen(PORT, () => {
  console.log(`🚀 TradePilot Local Relay Bridge listening on http://localhost:${PORT}`);
});
