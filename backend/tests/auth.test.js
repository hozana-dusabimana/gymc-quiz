import { describe, it, expect } from 'vitest';
import { request, signup, uniqueEmail, auth } from './helpers.js';
import { query } from '../src/db/pool.js';

describe('auth', () => {
  it('registers a user and issues an OTP', async () => {
    const email = uniqueEmail('leader');
    const res = await request.post('/api/auth/register').send({ name: 'Ada L', email, role: 'leader' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.otpSent).toBe(true);
    expect(res.body.data.devCode).toMatch(/^\d{6}$/);
  });

  it('rejects invalid registration payloads', async () => {
    const res = await request.post('/api/auth/register').send({ name: 'x', email: 'nope', role: 'admin' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a wrong OTP and accepts the right one', async () => {
    const email = uniqueEmail('member');
    const reg = await request.post('/api/auth/register').send({ name: 'Bo Bo', email, role: 'member' });
    const bad = await request.post('/api/auth/verify-otp').send({ email, code: '000000' });
    expect(bad.status).toBe(400);
    const good = await request.post('/api/auth/verify-otp').send({ email, code: reg.body.data.devCode });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTruthy();
    expect(good.body.data.user.role).toBe('member');
    expect(good.headers['set-cookie']?.join()).toMatch(/gymc_rt=/);
  });

  it('does not allow re-registering an active account', async () => {
    const s = await signup('member');
    const res = await request.post('/api/auth/register').send({ name: 'Dup', email: s.email, role: 'member' });
    expect(res.status).toBe(409);
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

  it('does not reveal whether an email exists on request-otp', async () => {
    const res = await request.post('/api/auth/request-otp').send({ email: 'ghost@nowhere.local' });
    expect(res.status).toBe(200);
    expect(res.body.data.otpSent).toBe(true);
  });

  it('signs in with a member registration number instead of email', async () => {
    const email = uniqueEmail('regno');
    const reg = await request.post('/api/auth/register').send({ name: 'Reg Member', email, role: 'member' });
    await request.post('/api/auth/verify-otp').send({ email, code: reg.body.data.devCode });

    const regNo = `2${String(Date.now()).slice(-5)}/2024`;
    await query('UPDATE users SET member_number = $2 WHERE lower(email) = lower($1)', [email, regNo]);

    const otp = await request.post('/api/auth/request-otp').send({ identifier: regNo });
    expect(otp.status).toBe(200);
    expect(otp.body.data.otpSent).toBe(true);
    // the real address is never echoed back — only a masked hint
    expect(otp.body.data.sentTo).toContain('@');
    expect(otp.body.data.sentTo).not.toBe(email.toLowerCase());
    expect(otp.body.data.devCode).toMatch(/^\d{6}$/);

    // verify by the numeric stem of the reg number too
    const login = await request
      .post('/api/auth/verify-otp')
      .send({ identifier: regNo.split('/')[0], code: otp.body.data.devCode });
    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(email.toLowerCase());
    expect(login.body.data.accessToken).toBeTruthy();
  });

  it('does not reveal whether a registration number exists', async () => {
    const res = await request.post('/api/auth/request-otp').send({ identifier: '00000/1900' });
    expect(res.status).toBe(200);
    expect(res.body.data.otpSent).toBe(true);
    expect(res.body.data.sentTo).toBeUndefined();
  });

  it('rejects request-otp with neither identifier nor email', async () => {
    const res = await request.post('/api/auth/request-otp').send({});
    expect(res.status).toBe(422);
  });
});
