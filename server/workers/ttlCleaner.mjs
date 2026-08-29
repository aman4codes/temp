import fs from 'fs';
import { storeService } from '../services/storeService.mjs';

/**
 * Background TTL Worker - Runs every 5 seconds checking for expired items (>15 mins)
 */
export function startTTLWorker() {
  setInterval(() => {
    const now = Date.now();
    for (const [code, item] of storeService.entries()) {
      if (now >= item.expiresAt) {
        if (item.type === 'file' && item.filePath && fs.existsSync(item.filePath)) {
          try {
            fs.unlinkSync(item.filePath);
            console.log(`[TTL Worker] Expired file deleted: ${item.filePath} (Code: ${code})`);
          } catch (err) {
            console.error(`[TTL Worker] Failed to delete file ${item.filePath}:`, err);
          }
        }
        storeService.delete(code);
      }
    }
  }, 5000);
}
