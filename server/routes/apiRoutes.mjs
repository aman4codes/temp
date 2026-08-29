import { Router } from 'express';
import { shareController } from '../controllers/shareController.mjs';
import { uploadMiddleware } from '../middleware/uploadMiddleware.mjs';
import { uploadRateLimit, downloadRateLimit, deleteRateLimit } from '../middleware/rateLimiter.mjs';

const router = Router();

// Upload – rate-limited to 20 per 15-min window per IP
router.post('/upload', uploadRateLimit, uploadMiddleware.single('file'), shareController.handleUpload);

// Metadata lookup – covered by download rate limit (same brute-force vector)
router.get('/file/:code', downloadRateLimit, shareController.getFileMetadata);

// Download routes – rate-limited to guard against code brute-forcing
router.post('/download/:code', downloadRateLimit, shareController.downloadPost);
router.get('/download/:code', downloadRateLimit, shareController.downloadGet);

// Manual self-destruct – strict per-IP limit
router.post('/delete/:code', deleteRateLimit, shareController.deleteFile);

// System stats – no auth required, not rate-limited (lightweight read)
router.get('/stats', shareController.getStats);

export default router;
