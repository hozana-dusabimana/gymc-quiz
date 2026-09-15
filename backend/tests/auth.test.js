import { describe, it, expect } from 'vitest';
import { request, signup, uniqueEmail, uniquePhone, auth, DEFAULT_PASSWORD } from './helpers.js';

describe('auth', () => {
  it('registers a user with name/phone/email/password and logs them straight in as a member', async () => {
    const email = uniqueEmail('member');
    const phone = uniquePhone();
    const res = await request
      .post('/api/auth/register')
      .send({ name: 'Ada L', email, phone, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('member');
    expect(res.body.data.user.email).toBe(email.toLowerCase());
    expect(res.headers['set-cookie']?.join()).toMatch(/gymc_rt=/);
  });

  it('ignores a role in the public registration payload — always creates a member', async () => {
    const email = uniqueEmail('sneaky');
    const res = await request
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email, phone: uniquePhone(), role: 'leader', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('member');
  });

  it('rejects invalid registration payloads', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ name: 'x', email: 'nope', phone: '123', password: '123' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration missing a password or phone', async () => {
    const email = uniqueEmail('member');
    const res = await request.post('/api/auth/register').send({ name: 'No Pass', email });
    expect(res.status).toBe(422);
  });

  it('does not allow re-registering an active email or phone', async () => {
    const s = await signup('member');
    const byEmail = await request
      .post('/api/auth/register')
      .send({ name: 'Dup', email: s.email, phone: uniquePhone(), password: DEFAULT_PASSWORD });
    expect(byEmail.status).toBe(409);
    const byPhone = await request
      .post('/api/auth/register')
      .send({ name: 'Dup', email: uniqueEmail('member'), phone: s.phone, password: DEFAULT_PASSWORD });
    expect(byPhone.status).toBe(409);
  });

  it('logs in with email + password', async () => {
    const s = await signup('member');
    const res = await request.post('/api/auth/login').send({ identifier: s.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(s.email.toLowerCase());
  });

  it('logs in with phone + password', async () => {
    const s = await signup('leader');
    const res = await request.post('/api/auth/login').send({ identifier: s.phone, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('leader');
  });

  it('rejects a wrong password', async () => {
    const s = await signup('member');
    const res = await request.post('/api/auth/login').send({ identifier: s.email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('rejects login for an unknown identifier without revealing it', async () => {
    const res = await request.post('/api/auth/login').send({ identifier: 'ghost@nowhere.local', password: 'whatever1' });
    expect(res.status).toBe(401);
  });

  it('/api/auth/me requires a token and returns the user', async () => {
    const noTok = await request.get('/api/auth/me');
    expect(noTok.status).toBe(401);
    const s = await signup('leader');
    const me = await request.get('/api/auth/me').set(auth(s.token));
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(s.email);
  });

  it('refreshes a session with the refresh cookie', async () => {
    const s = await signup('member');
    const res = await request.post('/api/auth/refresh').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });
});
