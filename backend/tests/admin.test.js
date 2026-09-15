import { describe, it, expect } from 'vitest';
import { request, signup, uniqueEmail, uniquePhone, auth, adminToken, DEFAULT_PASSWORD } from './helpers.js';

describe('admin-gated leader/admin creation', () => {
  it('the seeded admin account can log in', async () => {
    const token = await adminToken();
    expect(token).toBeTruthy();
  });

  it('admin creates a leader, who can then log in', async () => {
    const token = await adminToken();
    const email = uniqueEmail('newleader');
    const phone = uniquePhone();
    const created = await request
      .post('/api/admin/users')
      .set(auth(token))
      .send({ name: 'New Leader', email, phone, role: 'leader', password: DEFAULT_PASSWORD });
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe('leader');
    // the admin's own request never receives the new user's tokens
    expect(created.body.data.accessToken).toBeUndefined();

    const login = await request.post('/api/auth/login').send({ identifier: email, password: DEFAULT_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('leader');
  });

  it('admin creates another admin', async () => {
    const token = await adminToken();
    const res = await request
      .post('/api/admin/users')
      .set(auth(token))
      .send({ name: 'Second Admin', email: uniqueEmail('admin2'), phone: uniquePhone(), role: 'admin', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('a leader cannot create other leaders', async () => {
    const leader = await signup('leader');
    const res = await request
      .post('/api/admin/users')
      .set(auth(leader.token))
      .send({ name: 'Nope', email: uniqueEmail('nope'), phone: uniquePhone(), role: 'leader', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('a member cannot create leaders and cannot list staff', async () => {
    const member = await signup('member');
    const create = await request
      .post('/api/admin/users')
      .set(auth(member.token))
      .send({ name: 'Nope', email: uniqueEmail('nope2'), phone: uniquePhone(), role: 'leader', password: DEFAULT_PASSWORD });
    expect(create.status).toBe(403);
    const list = await request.get('/api/admin/users').set(auth(member.token));
    expect(list.status).toBe(403);
  });

  it('unauthenticated requests are rejected', async () => {
    const res = await request.get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('admin lists staff accounts', async () => {
    const token = await adminToken();
    const leader = await signup('leader');
    const list = await request.get('/api/admin/users').set(auth(token));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data.users)).toBe(true);
    expect(list.body.data.users.some((u) => u.email === leader.email.toLowerCase())).toBe(true);
    expect(list.body.data.users.every((u) => ['leader', 'admin'].includes(u.role))).toBe(true);
  });
});
