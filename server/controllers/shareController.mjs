import crypto from 'crypto';
import fs from 'fs';
import { storeService } from '../services/storeService.mjs';
import { EXPIRATION_MS } from '../config/constants.mjs';

export const shareController = {
  // 1. Upload File or Text Snippet
  handleUpload(req, res) {
    try {
      const { mode, textContent, title, password } = req.body;
      const code = storeService.generateUniqueCode();
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

      storeService.set(code, itemData);

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
  },

  // 2. Get Metadata / Check Code Status
  getFileMetadata(req, res) {
    const code = req.params.code?.trim();
    const item = storeService.get(code);

    if (!item) {
      return res.status(404).json({
        expired: true,
        error: 'Invalid code or the shared item has expired (15-min threshold).'
      });
    }

    const now = Date.now();
    if (now >= item.expiresAt) {
      if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
        try { fs.unlinkSync(item.filePath); } catch (e) {}
      }
      storeService.delete(code);
      return res.status(404).json({
        expired: true,
        error: 'This file has expired and been automatically self-destructed.'
      });
    }

    const remainingSeconds = Math.max(0, Math.floor((item.expiresAt - now) / 1000));

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
  },

  // 3. Download File or Text Snippet (POST endpoint)
  downloadPost(req, res) {
    const code = req.params.code?.trim();
    const { password } = req.body || {};
    const item = storeService.get(code);

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

    if (item.type === 'file' && item.filePath) {
      if (!fs.existsSync(item.filePath)) {
        return res.status(404).json({ error: 'File missing from server storage.' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.originalName)}"`);
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      return res.sendFile(item.filePath);
    }

    return res.status(500).json({ error: 'Unable to stream file.' });
  },

  // Direct GET Download Link
  downloadGet(req, res) {
    const code = req.params.code?.trim();
    const item = storeService.get(code);

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
  },

  // 4. Delete File (Self-Destruct)
  deleteFile(req, res) {
    const code = req.params.code?.trim();
    const { deleteToken } = req.body || {};
    const item = storeService.get(code);

    if (!item) {
      return res.status(404).json({ error: 'File already deleted or expired.' });
    }

    if (item.deleteToken && item.deleteToken !== deleteToken) {
      return res.status(403).json({ error: 'Unauthorized to delete this file.' });
    }

    if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
      try { fs.unlinkSync(item.filePath); } catch (e) {}
    }

    storeService.delete(code);
    console.log(`[Manual Purge] File with code ${code} was destroyed manually.`);

    return res.status(200).json({ success: true, message: 'File permanently destroyed.' });
  },

  // 5. System Stats
  getStats(req, res) {
    res.json({
      activeFiles: storeService.getActiveCount(),
      totalPurged: storeService.getTotalPurgedCount(),
      ttlMinutes: 15
    });
  }
};
