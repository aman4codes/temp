import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PORT = process.env.PORT || 3001;

/** 15-minute Time-To-Live for every upload */
export const EXPIRATION_MS = 15 * 60 * 1000;

/** Where multer saves incoming files */
export const UPLOADS_DIR = path.join(__dirname, '../uploads');

/** Hard cap for incoming file uploads (100 MB) */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** bcrypt cost factor for password hashing */
export const BCRYPT_ROUNDS = 10;

/**
 * Allowed MIME types.
 * Set to null to allow any file type (less safe).
 * Extend this list as needed for your use-case.
 */
export const ALLOWED_MIME_TYPES = null; // e.g. ['image/png', 'application/pdf', 'text/plain']

/** Maximum text snippet size in bytes (1 MB) */
export const MAX_TEXT_SIZE_BYTES = 1 * 1024 * 1024;
