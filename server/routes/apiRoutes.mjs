import { Router } from 'express';
import { shareController } from '../controllers/shareController.mjs';
import { uploadMiddleware } from '../middleware/uploadMiddleware.mjs';

const router = Router();

// Upload route
router.post('/upload', uploadMiddleware.single('file'), shareController.handleUpload);

// File metadata status route
router.get('/file/:code', shareController.getFileMetadata);

// Download routes
router.post('/download/:code', shareController.downloadPost);
router.get('/download/:code', shareController.downloadGet);

// Manual self-destruct route
router.post('/delete/:code', shareController.deleteFile);

// System stats route
router.get('/stats', shareController.getStats);

export default router;
