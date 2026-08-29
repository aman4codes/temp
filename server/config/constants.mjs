import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PORT = process.env.PORT || 3001;
export const EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes TTL
export const UPLOADS_DIR = path.join(__dirname, '../uploads');
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB max
