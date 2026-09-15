import { describe, it, expect } from 'vitest';
import { request } from './helpers.js';

describe('error handler', () => {
  it('returns 400 (not 500) for a malformed JSON body', async () => {
    const res = await request
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{ not: valid json');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('still 404s unknown routes with an envelope', async () => {
    const res = await request.get('/api/nope/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
