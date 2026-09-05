import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/error.js';
import { requestIdMiddleware } from '../src/middleware/requestContext.js';
import { apiHelmet, csrfGuard, enforceContentType, permissionsPolicy } from '../src/middleware/security.js';

/** The middleware stack under test, without routes or a database behind it. */
const app = () => {
  const instance = express();
  instance.use(requestIdMiddleware);
  instance.use(apiHelmet);
  instance.use(permissionsPolicy);
  instance.use(enforceContentType);
  instance.use(express.json());
  instance.use(csrfGuard);
  instance.post('/echo', (_req, res) => res.json({ success: true, data: 'ok' }));
  instance.get('/echo', (_req, res) => res.json({ success: true, data: 'ok' }));
  instance.use(errorHandler);
  return instance;
};

describe('request id', () => {
  it('issues an id and echoes it back on the response', async () => {
    const res = await request(app()).get('/echo');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('honours a well-formed inbound id so a trace survives the hop', async () => {
    const res = await request(app()).get('/echo').set('X-Request-Id', 'trace-abc-123');
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('replaces an id carrying control characters rather than logging it', async () => {
    const res = await request(app()).get('/echo').set('X-Request-Id', 'bad id with spaces');
    expect(res.headers['x-request-id']).not.toBe('bad id with spaces');
  });
});

describe('security headers', () => {
  it('denies framing, sniffing and referrer leakage', async () => {
    const res = await request(app()).get('/echo');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('denies the device APIs the API has no use for', async () => {
    const res = await request(app()).get('/echo');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['permissions-policy']).toContain('microphone=()');
  });
});

describe('content type enforcement', () => {
  it('rejects a body the API cannot parse with 415', async () => {
    const res = await request(app()).post('/echo').set('Content-Type', 'text/xml').send('<a/>');
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('allows JSON bodies through', async () => {
    const res = await request(app()).post('/echo').send({ ok: true });
    expect(res.status).toBe(200);
  });
});

describe('csrf guard', () => {
  it('allows a cookie-bearing request from an allowed origin', async () => {
    const res = await request(app())
      .post('/echo')
      .set('Cookie', 'refreshToken=abc')
      .set('Origin', 'http://localhost:5173')
      .send({});
    expect(res.status).toBe(200);
  });

  it('rejects a cookie-bearing request from a foreign origin', async () => {
    const res = await request(app())
      .post('/echo')
      .set('Cookie', 'refreshToken=abc')
      .set('Origin', 'https://attacker.example')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
  });

  it('rejects a cookie-bearing request that declares no origin at all', async () => {
    const res = await request(app()).post('/echo').set('Cookie', 'refreshToken=abc').send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_ORIGIN_MISSING');
  });

  it('leaves bearer-token clients alone, since they send no cookie', async () => {
    const res = await request(app()).post('/echo').set('Authorization', 'Bearer token').send({});
    expect(res.status).toBe(200);
  });

  it('does not challenge safe methods', async () => {
    const res = await request(app())
      .get('/echo')
      .set('Cookie', 'refreshToken=abc')
      .set('Origin', 'https://attacker.example');
    expect(res.status).toBe(200);
  });
});
