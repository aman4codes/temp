import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PORT } from './config/constants.mjs';
import apiRoutes from './routes/apiRoutes.mjs';
import { startTTLWorker } from './workers/ttlCleaner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API Routes
app.use('/api', apiRoutes);

// Start Expiration Background Worker
startTTLWorker();

// Serve frontend static production build if present
const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 ChronoShare 15m Modular Backend active at http://localhost:${PORT}`);
});
