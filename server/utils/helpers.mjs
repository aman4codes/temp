/**
 * Centralised API error helper.
 * Always returns a consistent JSON shape and never leaks stack traces in production.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Send a structured error response.
 * @param {import('express').Response} res
 * @param {number} status   HTTP status code
 * @param {string} message  Human-readable message sent to client
 * @param {Error|null} [err] Internal error – logged server-side only
 */
export function sendError(res, status, message, err = null) {
  if (err) {
    // Always log the full error server-side
    console.error(`[API Error ${status}] ${message}`, IS_PROD ? err.message : err);
  }
  return res.status(status).json({ error: message });
}

/**
 * Sanitise a user-supplied filename so it cannot traverse directories.
 * Strips path separators and limits length.
 */
export function sanitiseFilename(name = '') {
  return (name || 'unnamed')
    .replace(/[/\\?%*:|"<>]/g, '_') // strip path/shell specials
    .replace(/\.{2,}/g, '_')         // no double-dots
    .trim()
    .slice(0, 255)                   // max filename length
    || 'unnamed';
}

/**
 * Validate a 6-digit access code format.
 * Returns true if the code looks like a valid code.
 */
export function isValidCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{6}$/i.test(code.trim());
}
