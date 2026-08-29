import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { storeService } from '../services/storeService.mjs';
import { EXPIRATION_MS, BCRYPT_ROUNDS, ALLOWED_MIME_TYPES, MAX_TEXT_SIZE_BYTES } from '../config/constants.mjs';
import { sendError, sanitiseFilename, isValidCode } from '../utils/helpers.mjs';

export const shareController = {

  // ── 1. Upload ───────────────────────────────────────────────────────────────
  async handleUpload(req, res) {
    try {
      const { mode, textContent, title, password } = req.body;

      // ── Input validation ────────────────────────────────────────────────────
      // MIME-type allowlist (if configured)
      if (req.file && ALLOWED_MIME_TYPES) {
        if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
          // Remove the rejected file from disk
          try { fs.unlinkSync(req.file.path); } catch (_) {}
          return sendError(res, 415, `File type "${req.file.mimetype}" is not permitted.`);
        }
      }

      // Text size cap
      if (mode === 'text') {
        if (!textContent || !textContent.trim()) {
          return sendError(res, 400, 'Text content cannot be empty.');
        }
        if (Buffer.byteLength(textContent, 'utf8') > MAX_TEXT_SIZE_BYTES) {
          return sendError(res, 413, 'Text snippet exceeds the 1 MB limit.');
        }
      }

      if (mode !== 'text' && !req.file) {
        return sendError(res, 400, 'No file or text content provided.');
      }

      // ── Hash password (if provided) ─────────────────────────────────────────
      let passwordHash = null;
      if (password && typeof password === 'string' && password.length > 0) {
        if (password.length > 128) {
          return sendError(res, 400, 'Password must not exceed 128 characters.');
        }
        passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      }

      const code = storeService.generateUniqueCode();
      const deleteToken = crypto.randomBytes(24).toString('hex'); // 48-char hex token
      const createdAt = Date.now();
      const expiresAt = createdAt + EXPIRATION_MS;

      let itemData = {
        code,
        deleteToken,
        createdAt,
        expiresAt,
        downloads: 0,
        hasPassword: !!passwordHash,
        passwordHash,           // ← hashed, never plaintext
      };

      if (mode === 'text' || (!req.file && textContent)) {
        const safeName = sanitiseFilename(title || 'Untitled Snippet.txt');
        itemData.type = 'text';
        itemData.originalName = safeName;
        itemData.mimeType = 'text/plain';
        itemData.textContent = textContent;
        itemData.size = Buffer.byteLength(textContent, 'utf8');
      } else {
        const safeName = sanitiseFilename(req.file.originalname);
        itemData.type = 'file';
        itemData.originalName = safeName;
        itemData.mimeType = req.file.mimetype;
        itemData.size = req.file.size;
        itemData.filePath = req.file.path;
        itemData.filename = req.file.filename;
      }

      storeService.set(code, itemData);

      console.log(`[Upload] code=${code} type=${itemData.type} size=${itemData.size} hasPass=${itemData.hasPassword}`);

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
        hasPassword: itemData.hasPassword,
      });
    } catch (error) {
      return sendError(res, 500, 'Server error while processing upload.', error);
    }
  },

  // ── 2. Metadata ─────────────────────────────────────────────────────────────
  getFileMetadata(req, res) {
    const code = req.params.code?.trim().toUpperCase();

    if (!isValidCode(code)) {
      return sendError(res, 400, 'Invalid code format. Must be 6 alphanumeric characters.');
    }

    const item = storeService.get(code);

    if (!item) {
      return res.status(404).json({ expired: true, error: 'Code not found or item has already expired.' });
    }

    const now = Date.now();
    if (now >= item.expiresAt) {
      shareController._purgeItem(code, item, 'TTL-on-read');
      return res.status(404).json({ expired: true, error: 'This item has expired and been automatically purged.' });
    }

    const remainingSeconds = Math.max(0, Math.floor((item.expiresAt - now) / 1000));

    // Only send plaintext preview for unprotected text snippets
    const previewText = (item.type === 'text' && !item.hasPassword) ? item.textContent : null;

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
      textContent: previewText,
    });
  },

  // ── 3a. Download (POST – handles password-protected items) ──────────────────
  async downloadPost(req, res) {
    const code = req.params.code?.trim().toUpperCase();

    if (!isValidCode(code)) {
      return sendError(res, 400, 'Invalid code format.');
    }

    const { password } = req.body || {};
    const item = storeService.get(code);

    if (!item) {
      return sendError(res, 404, 'File expired or not found.');
    }

    if (Date.now() >= item.expiresAt) {
      shareController._purgeItem(code, item, 'TTL-on-download');
      return sendError(res, 410, 'This item has expired.');
    }

    // ── Password verification using constant-time bcrypt compare ───────────────
    if (item.hasPassword) {
      if (!password || typeof password !== 'string') {
        return sendError(res, 401, 'Password required.');
      }
      const match = await bcrypt.compare(password, item.passwordHash);
      if (!match) {
        console.warn(`[Auth Fail] Wrong password for code ${code}`);
        return sendError(res, 401, 'Incorrect password.');
      }
    }

    item.downloads += 1;

    if (item.type === 'text') {
      return res.status(200).json({ success: true, type: 'text', originalName: item.originalName, textContent: item.textContent });
    }

    if (item.type === 'file') {
      if (!item.filePath || !fs.existsSync(item.filePath)) {
        return sendError(res, 404, 'File missing from server storage.');
      }
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.originalName)}"`);
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.sendFile(path.resolve(item.filePath));
    }

    return sendError(res, 500, 'Unable to serve item.');
  },

  // ── 3b. Download (GET – public QR / URL-based, no password) ────────────────
  downloadGet(req, res) {
    const code = req.params.code?.trim().toUpperCase();

    if (!isValidCode(code)) {
      return res.status(400).send('<h1>Invalid Code</h1>');
    }

    const item = storeService.get(code);

    if (!item || Date.now() >= item.expiresAt) {
      if (item) shareController._purgeItem(code, item, 'TTL-on-get-download');
      return res.status(404).send('<h1>File Expired or Not Found</h1><p>Files self-destruct after 15 minutes.</p>');
    }

    if (item.hasPassword) {
      // Redirect browser to frontend so user can enter password
      return res.redirect(`/?code=${encodeURIComponent(code)}`);
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
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.sendFile(path.resolve(item.filePath));
    }

    return res.status(500).send('<h1>Server Error</h1>');
  },

  // ── 4. Delete (Self-Destruct) ───────────────────────────────────────────────
  deleteFile(req, res) {
    const code = req.params.code?.trim().toUpperCase();

    if (!isValidCode(code)) {
      return sendError(res, 400, 'Invalid code format.');
    }

    const { deleteToken } = req.body || {};
    const item = storeService.get(code);

    if (!item) {
      return sendError(res, 404, 'File already deleted or expired.');
    }

    // Constant-time comparison to resist timing attacks on the token
    const expected = Buffer.from(item.deleteToken || '', 'utf8');
    const supplied = Buffer.from(deleteToken || '', 'utf8');
    const tokensMatch = expected.length === supplied.length &&
      crypto.timingSafeEqual(expected, supplied);

    if (!tokensMatch) {
      console.warn(`[Auth Fail] Bad deleteToken for code ${code}`);
      return sendError(res, 403, 'Unauthorized to delete this item.');
    }

    shareController._purgeItem(code, item, 'manual-delete');
    console.log(`[Purge] code=${code} reason=manual`);

    return res.status(200).json({ success: true, message: 'Item permanently destroyed.' });
  },

  // ── 5. Stats ────────────────────────────────────────────────────────────────
  getStats(_req, res) {
    return res.json({
      activeFiles: storeService.getActiveCount(),
      totalPurged: storeService.getTotalPurgedCount(),
      ttlMinutes: 15,
    });
  },

  // ── Internal: atomic purge helper ──────────────────────────────────────────
  _purgeItem(code, item, reason) {
    if (item?.type === 'file' && item.filePath) {
      try {
        if (fs.existsSync(item.filePath)) {
          fs.unlinkSync(item.filePath);
          console.log(`[Purge] code=${code} reason=${reason} file deleted`);
        }
      } catch (err) {
        console.error(`[Purge Error] Failed to delete file for code=${code}:`, err.message);
      }
    }
    storeService.delete(code);
  },
};
