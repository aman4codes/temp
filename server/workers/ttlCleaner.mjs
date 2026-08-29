import fs from 'fs';
import { storeService } from '../services/storeService.mjs';
import { shareController } from '../controllers/shareController.mjs';

const POLL_INTERVAL_MS = 5_000; // Every 5 seconds

/**
 * Background TTL Worker.
 * Polls the in-memory store every 5 seconds and purges items whose
 * expiresAt timestamp has passed.
 *
 * Uses shareController._purgeItem so disk deletion and store removal
 * are always handled atomically in one place.
 */
export function startTTLWorker() {
  let timer;

  const sweep = () => {
    const now = Date.now();
    for (const [code, item] of storeService.entries()) {
      if (now >= item.expiresAt) {
        shareController._purgeItem(code, item, 'ttl-worker');
      }
    }
  };

  // Start background sweep
  timer = setInterval(sweep, POLL_INTERVAL_MS);

  // Allow Node.js to exit even if the timer is still running
  if (timer.unref) timer.unref();

  console.log(`[TTL Worker] Started — sweeping every ${POLL_INTERVAL_MS / 1000}s`);
}
