import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import apiRoutes from '../server/routes/apiRoutes.mjs';

// Build a minimal express app identical to the real one for testing
function buildTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', apiRoutes);
  return app;
}

describe('Upload → Metadata → Download → Delete lifecycle', () => {
  let app;

  beforeEach(() => {
    app = buildTestApp();
  });

  it('should upload a text snippet and return a 6-character code', async () => {
    const res = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Hello from test')
      .field('title', 'test-snippet.txt');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.code).toMatch(/^[A-Z0-9]{6}$/i);
    expect(res.body.type).toBe('text');
    expect(res.body.hasPassword).toBe(false);
  });

  it('should retrieve metadata for an active code', async () => {
    const upload = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Metadata test')
      .field('title', 'meta.txt');

    const code = upload.body.code;

    const meta = await request(app).get(`/api/file/${code}`);
    expect(meta.status).toBe(200);
    expect(meta.body.code).toBe(code);
    expect(meta.body.type).toBe('text');
    expect(meta.body.hasPassword).toBe(false);
    expect(meta.body.textContent).toBe('Metadata test');
    expect(meta.body.remainingSeconds).toBeGreaterThan(0);
  });

  it('should return 404 for an unknown code', async () => {
    const res = await request(app).get('/api/file/000000');
    expect(res.status).toBe(404);
    expect(res.body.expired).toBe(true);
  });

  it('should return text content via POST /download', async () => {
    const upload = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Download me')
      .field('title', 'dl.txt');

    const code = upload.body.code;

    const dl = await request(app).post(`/api/download/${code}`).send({});
    expect(dl.status).toBe(200);
    expect(dl.body.textContent).toBe('Download me');
  });

  it('should enforce password on password-protected snippets', async () => {
    const upload = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Secret')
      .field('title', 'secret.txt')
      .field('password', 'hunter2');

    const code = upload.body.code;

    // No password → 401
    const noPass = await request(app).post(`/api/download/${code}`).send({});
    expect(noPass.status).toBe(401);

    // Wrong password → 401
    const wrongPass = await request(app).post(`/api/download/${code}`).send({ password: 'wrongpassword' });
    expect(wrongPass.status).toBe(401);

    // Correct password → 200
    const correct = await request(app).post(`/api/download/${code}`).send({ password: 'hunter2' });
    expect(correct.status).toBe(200);
    expect(correct.body.textContent).toBe('Secret');
  });

  it('should not expose password hash or plaintext in metadata response', async () => {
    const upload = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Protected text')
      .field('title', 'p.txt')
      .field('password', 'abc123');

    const code = upload.body.code;
    const meta = await request(app).get(`/api/file/${code}`);

    expect(meta.body.password).toBeUndefined();
    expect(meta.body.passwordHash).toBeUndefined();
    expect(meta.body.textContent).toBeNull(); // hidden for password-protected
    expect(meta.body.hasPassword).toBe(true);
  });

  it('should manually destroy a file with valid deleteToken', async () => {
    const upload = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Destroy me')
      .field('title', 'd.txt');

    const { code, deleteToken } = upload.body;

    const del = await request(app)
      .post(`/api/delete/${code}`)
      .send({ deleteToken });

    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    // Confirm it's gone
    const meta = await request(app).get(`/api/file/${code}`);
    expect(meta.status).toBe(404);
  });

  it('should reject delete with a wrong deleteToken', async () => {
    const upload = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', 'Keep me')
      .field('title', 'k.txt');

    const { code } = upload.body;

    const del = await request(app)
      .post(`/api/delete/${code}`)
      .send({ deleteToken: 'wrong-token-totally-wrong' });

    expect(del.status).toBe(403);
  });

  it('should reject uploads with empty text content', async () => {
    const res = await request(app)
      .post('/api/upload')
      .field('mode', 'text')
      .field('textContent', '')
      .field('title', 'empty.txt');

    expect(res.status).toBe(400);
  });

  it('should reject requests with an invalid code format', async () => {
    const res = await request(app).get('/api/file/TOOLONGCODE');
    expect(res.status).toBe(400);
  });

  it('should return stats via /api/stats', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.activeFiles).toBe('number');
    expect(typeof res.body.totalPurged).toBe('number');
    expect(res.body.ttlMinutes).toBe(15);
  });
});
