# ChronoShare 15m

> Ephemeral file & text-snippet sharing with strict 15-minute auto-purge, 6-digit access codes, and QR code delivery.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start backend + frontend dev servers together
npm run dev

# OR run servers separately
npm run dev:backend    # Express → http://localhost:3001
npm run dev:frontend   # Vite    → http://localhost:5173  (proxied to backend)
```

## Production

```bash
npm run build          # Builds React SPA into /dist
node server/index.mjs  # Serves /dist + API on http://localhost:3001
```

## Testing

```bash
npm test               # Run all tests once         (vitest)
npm run test:watch     # Re-run on file changes
npm run test:coverage  # Generate coverage report
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values before deploying:

| Variable        | Default         | Description                                                      |
|-----------------|-----------------|------------------------------------------------------------------|
| `PORT`          | `3001`          | HTTP port the server listens on                                  |
| `NODE_ENV`      | `development`   | Set to `production` to enable CSP, restrict CORS, hide errors    |
| `CORS_ORIGINS`  | *(empty)*       | Comma-separated allowed origins in production (e.g. `https://yourapp.com`) |

---

## Architecture

```
chronoshare-15m/
├── index.html                  # Vite SPA entrypoint
├── src/                        # React frontend
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── ActiveTransfers.jsx
│   │   ├── Navbar.jsx
│   │   ├── QRCodeDisplay.jsx
│   │   ├── RetrieveForm.jsx
│   │   ├── ShareResultCard.jsx
│   │   ├── Toast.jsx
│   │   └── UploadForm.jsx
│   ├── hooks/
│   │   └── useCountdown.js     # Custom hook for per-second countdown
│   ├── services/
│   │   └── apiService.js       # All fetch() calls centralised here
│   └── utils/
│       └── fileHelpers.jsx     # formatFileSize, formatMinutesSeconds, getFileIcon
│
└── server/                     # Express backend
    ├── index.mjs               # App bootstrap, middleware, error handler
    ├── config/
    │   └── constants.mjs       # TTL, BCRYPT_ROUNDS, limits, CORS, etc.
    ├── controllers/
    │   └── shareController.mjs # Business logic for all routes
    ├── middleware/
    │   ├── rateLimiter.mjs     # Per-route IP rate limiters
    │   └── uploadMiddleware.mjs # Multer disk storage config
    ├── routes/
    │   └── apiRoutes.mjs       # Route → middleware → controller wiring
    ├── services/
    │   └── storeService.mjs    # In-memory Map store with unique code generator
    ├── utils/
    │   └── helpers.mjs         # sendError, sanitiseFilename, isValidCode
    └── workers/
        └── ttlCleaner.mjs      # Background sweep every 5s
```

---

## Security Notes

| Concern | Implementation |
|---|---|
| **Password storage** | `bcryptjs` (cost 10) — raw passwords are never stored |
| **Delete token validation** | `crypto.timingSafeEqual` — prevents timing attacks |
| **Code brute-force** | Rate-limited: 30 lookups / 5 min / IP |
| **Upload abuse** | Rate-limited: 20 uploads / 15 min / IP |
| **Security headers** | `helmet` with full CSP in production mode |
| **CORS** | Locked to `CORS_ORIGINS` in production |
| **Filename injection** | `sanitiseFilename()` strips path traversal chars |
| **Input validation** | Code format, MIME allowlist (configurable), text size cap (1 MB) |

> ⚠️ **Persistence**: The store is in-memory. A server restart clears all active codes. For production, replace `storeService` with a Redis or SQLite-backed store.

> ⚠️ **HTTPS**: Always deploy behind HTTPS (e.g. via Nginx + Let's Encrypt or Cloudflare). Without TLS, passwords and file bytes transit in plaintext.
