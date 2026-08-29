import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Upload directory setup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max file size
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory store for shared items
// Key: 6-digit access code (e.g. "849201")
const sharedItems = new Map();
let totalPurgedCount = 0;

// Helper: Generate unique 6-digit numeric code
function generateUniqueCode() {
  let code;
  let attempts = 0;
  do {
    // 6-digit number between 100000 and 999999
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
    if (attempts > 100) {
      code = crypto.randomBytes(3).toString('hex').toUpperCase(); // Fallback if crowded
      break;
    }
  } while (sharedItems.has(code));
  return code;
}

// TTL Cleanup Worker - Runs every 5 seconds
const EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

setInterval(() => {
  const now = Date.now();
  for (const [code, item] of sharedItems.entries()) {
    if (now >= item.expiresAt) {
      // Purge file from disk if it exists
      if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
        try {
          fs.unlinkSync(item.filePath);
          console.log(`[TTL Worker] Expired file deleted: ${item.filePath} (Code: ${code})`);
        } catch (err) {
          console.error(`[TTL Worker] Failed to delete file ${item.filePath}:`, err);
        }
      }
      sharedItems.delete(code);
      totalPurgedCount++;
    }
  }
}, 5000);

// API Routes

// 1. Upload File or Text Snippet
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const { mode, textContent, title, password } = req.body;
    const code = generateUniqueCode();
    const deleteToken = crypto.randomBytes(16).toString('hex');
    const createdAt = Date.now();
    const expiresAt = createdAt + EXPIRATION_MS;

    let itemData = {
      code,
      deleteToken,
      createdAt,
      expiresAt,
      downloads: 0,
      hasPassword: !!password,
      password: password || null,
    };

    if (mode === 'text' || (!req.file && textContent)) {
      itemData.type = 'text';
      itemData.originalName = title || 'Untitled Text Snippet.txt';
      itemData.mimeType = 'text/plain';
      itemData.textContent = textContent || '';
      itemData.size = Buffer.byteLength(textContent || '', 'utf8');
    } else if (req.file) {
      itemData.type = 'file';
      itemData.originalName = req.file.originalname;
      itemData.mimeType = req.file.mimetype;
      itemData.size = req.file.size;
      itemData.filePath = req.file.path;
      itemData.filename = req.file.filename;
    } else {
      return res.status(400).json({ error: 'No file or text content provided.' });
    }

    sharedItems.set(code, itemData);

    console.log(`[Upload Success] Code: ${code}, Type: ${itemData.type}, Expires in 15 mins.`);

    return res.status(200).json({
      success: true,
      code,
      deleteToken,
      type: itemData.type,
      originalName: itemData.originalName,
      size: itemData.size,
      mimeType: itemData.mimeType,
      createdAt,
      expiresAt,
      expiresInSeconds: Math.floor(EXPIRATION_MS / 1000),
      hasPassword: itemData.hasPassword
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({ error: 'Server error while processing upload.' });
  }
});

// 2. Get Metadata / Check Code Status
app.get('/api/file/:code', (req, res) => {
  const code = req.params.code?.trim();
  const item = sharedItems.get(code);

  if (!item) {
    return res.status(404).json({
      expired: true,
      error: 'Invalid code or the shared item has expired (15-min threshold).'
    });
  }

  const now = Date.now();
  if (now >= item.expiresAt) {
    // Purge immediately if caught on read
    if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
      try { fs.unlinkSync(item.filePath); } catch (e) {}
    }
    sharedItems.delete(code);
    totalPurgedCount++;
    return res.status(404).json({
      expired: true,
      error: 'This file has expired and been automatically self-destructed.'
    });
  }

  const remainingSeconds = Math.max(0, Math.floor((item.expiresAt - now) / 1000));

  // If text type, return text preview unless password required
  let previewText = null;
  if (item.type === 'text' && !item.hasPassword) {
    previewText = item.textContent;
  }

  return res.status(200).json({
    code: item.code,
    type: item.type,
    originalName: item.originalName,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    remainingSeconds,
    downloads: item.downloads,
    hasPassword: item.hasPassword,
    textContent: previewText
  });
});

// 3. Download File / Fetch Protected Text
app.post('/api/download/:code', (req, res) => {
  const code = req.params.code?.trim();
  const { password } = req.body || {};
  const item = sharedItems.get(code);

  if (!item) {
    return res.status(404).json({ error: 'File expired or not found.' });
  }

  if (Date.now() >= item.expiresAt) {
    return res.status(410).json({ error: 'File has expired.' });
  }

  if (item.hasPassword && item.password !== password) {
    return res.status(401).json({ error: 'Incorrect password provided.' });
  }

  item.downloads += 1;

  if (item.type === 'text') {
    return res.status(200).json({
      success: true,
      type: 'text',
      originalName: item.originalName,
      textContent: item.textContent
    });
  }

  // Stream raw file for download
  if (item.type === 'file' && item.filePath) {
    if (!fs.existsSync(item.filePath)) {
      return res.status(404).json({ error: 'File missing from server storage.' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.originalName)}"`);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    return res.sendFile(item.filePath);
  }

  return res.status(500).json({ error: 'Unable to stream file.' });
});

// Direct GET Download Link for simple browser download
app.get('/api/download/:code', (req, res) => {
  const code = req.params.code?.trim();
  const item = sharedItems.get(code);

  if (!item || Date.now() >= item.expiresAt) {
    return res.status(404).send('<h1>File Expired or Not Found</h1><p>Files self-destruct after 15 minutes.</p>');
  }

  if (item.hasPassword) {
    return res.status(401).send('<h1>Password Required</h1><p>Please enter password on the main portal.</p>');
  }

  item.downloads += 1;

  if (item.type === 'text') {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.originalName)}"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(item.textContent);
  }

  if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.originalName)}"`);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    return res.sendFile(item.filePath);
  }

  return res.status(500).send('Error reading file');
});

// 4. Delete File Immediately (Self-Destruct)
app.post('/api/delete/:code', (req, res) => {
  const code = req.params.code?.trim();
  const { deleteToken } = req.body || {};
  const item = sharedItems.get(code);

  if (!item) {
    return res.status(404).json({ error: 'File already deleted or expired.' });
  }

  if (item.deleteToken && item.deleteToken !== deleteToken) {
    return res.status(403).json({ error: 'Unauthorized to delete this file.' });
  }

  if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
    try { fs.unlinkSync(item.filePath); } catch (e) {}
  }

  sharedItems.delete(code);
  totalPurgedCount++;
  console.log(`[Manual Purge] File with code ${code} was destroyed manually.`);

  return res.status(200).json({ success: true, message: 'File permanently destroyed.' });
});

// 5. System Stats
app.get('/api/stats', (req, res) => {
  res.json({
    activeFiles: sharedItems.size,
    totalPurged: totalPurgedCount,
    ttlMinutes: 15
  });
});

// Serve frontend static build in production
const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 ChronoShare 15m Backend Server active at http://localhost:${PORT}`);
});
