import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PORT } from './config/constants.mjs';
import apiRoutes from './routes/apiRoutes.mjs';
import { startTTLWorker } from './workers/ttlCleaner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
          },
        }
      : false, // Disable CSP in dev so Vite HMR and Google Fonts work freely
    crossOriginEmbedderPolicy: false, // Needed for QR canvas rendering
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production restrict this to your actual domain(s).
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : IS_PROD
    ? [] // No origins allowed in prod unless CORS_ORIGINS env var is set
    : ['http://localhost:5173', 'http://localhost:3001'];

app.use(
  cors({
    origin: IS_PROD ? ALLOWED_ORIGINS : true, // Allow all in dev
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  })
);

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Enforce trust proxy for accurate IP-based rate limiting behind a proxy ───
app.set('trust proxy', 1);

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Global error handler ─────────────────────────────────────────────────────
// Catches errors thrown inside async route handlers
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = IS_PROD ? 'An unexpected server error occurred.' : (err.message || 'Unknown error');
  console.error(`[Unhandled Error] ${req.method} ${req.path}:`, err);
  res.status(status).json({ error: message });
});

// ── Start TTL worker ─────────────────────────────────────────────────────────
startTTLWorker();

// ── Serve frontend static build ───────────────────────────────────────────────
const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback – only for non-API paths
  app.get(/^(?!\/api\/).*$/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ── Start listening ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ChronoShare 15m Server → http://localhost:${PORT} [${IS_PROD ? 'PRODUCTION' : 'development'}]`);
});
