import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { env, getRedactedConfig } from './config/env.js';
import { apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

const app = express();
const server = http.createServer(app);

// Cross-Origin Resource Sharing
app.use(cors({
  origin: env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing with safe size bounds
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Non-sensitive request logging
app.use((req, res, next) => {
  if (req.path !== '/api/v1/health') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Mount Master API Router
app.use('/api/v1', apiRouter);

// Serve production frontend assets if built
app.use(express.static(frontendDistPath));

// For SPA client routing: serve index.html for all page routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.json({
        application: 'KlerkOne TradePilot API',
        version: '1.0.0',
        mode: env.DEFAULT_TRADING_MODE,
        status: 'ACTIVE',
        documentation: '/api/v1/health',
      });
    }
  });
});

// ------------------------------------------------------------------------------
// REALTIME WEBSOCKET SERVER
// ------------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    timestamp: new Date().toISOString(),
    message: 'Connected to KlerkOne TradePilot Realtime Feed',
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      }
    } catch (err) {
      // Ignore unformatted client messages
    }
  });
});

export function broadcastTelemetry(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

// ------------------------------------------------------------------------------
// SERVER START & LIFECYCLE
// ------------------------------------------------------------------------------
const PORT = env.PORT || 5000;

if (env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('================================================================');
    console.log(`🚀 KlerkOne TradePilot Backend running on port ${PORT}`);
    console.log(`🌐 REST API: http://localhost:${PORT}/api/v1`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`);
    console.log('🔒 Active Configuration (Redacted):', JSON.stringify(getRedactedConfig(), null, 2));
    console.log('================================================================');
  });
}

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing HTTP and WebSocket servers gracefully...`);
  wss.close();
  server.close(() => {
    console.log('✅ TradePilot Server terminated cleanly.');
    process.exit(0);
  });
  // Force close if hung
  setTimeout(() => {
    console.error('⚠️ Force shutdown timed out.');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
