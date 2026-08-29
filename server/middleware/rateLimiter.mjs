import rateLimit from 'express-rate-limit';

/**
 * Rate-limit for upload attempts: 20 uploads per 15-minute window per IP.
 * This matches the TTL window and prevents spam uploads.
 */
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads from this IP. Please try again in 15 minutes.' },
});

/**
 * Rate-limit for download / code lookup attempts: 30 per 5 minutes per IP.
 * Reduces the feasibility of brute-forcing 6-digit codes (900,000 space).
 * At 30 attempts per 5 min an attacker needs ~10,500 hours per code.
 */
export const downloadRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many access attempts from this IP. Slow down.' },
});

/**
 * Strict rate-limit for delete: 10 per 10 minutes per IP.
 */
export const deleteRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many delete requests. Please wait before trying again.' },
});
