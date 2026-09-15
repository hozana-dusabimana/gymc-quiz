import { describe, it, expect } from 'vitest';
import { request, signup, uniquePhone, auth, adminToken, DEFAULT_PASSWORD } from './helpers.js';

describe('admin manages leader/admin accounts', () => {
  it('admin edits a leader\'s name and phone', async () => {
    const token = await adminToken();
    const leader = await signup('leader');
    const newPhone = uniquePhone();
    const res = await request
      .patch(`/api/admin/users/${leader.user.id}`)
      .set(auth(token))
      .send({ name: 'Renamed Leader', phone: newPhone });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Renamed Leader');
    expect(res.body.data.user.phone).toBe(newPhone);
  });

  it('admin deactivates then reactivates a leader, blocking/restoring login', async () => {
    const token = await adminToken();
    const leader = await signup('leader');

    const off = await request
      .patch(`/api/admin/users/${leader.user.id}`)
      .set(auth(token))
      .send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.data.user.isActive).toBe(false);

    const blocked = await request.post('/api/auth/login').send({ identifier: leader.email, password: DEFAULT_PASSWORD });
    expect(blocked.status).toBe(401);

    const on = await request
      .patch(`/api/admin/users/${leader.user.id}`)
      .set(auth(token))
      .send({ isActive: true });
    expect(on.status).toBe(200);
    const restored = await request.post('/api/auth/login').send({ identifier: leader.email, password: DEFAULT_PASSWORD });
    expect(restored.status).toBe(200);
  });

  it('an admin cannot deactivate their own account', async () => {
    const token = await adminToken();
    const me = await request.get('/api/auth/me').set(auth(token));
    const res = await request
      .patch(`/api/admin/users/${me.body.data.user.id}`)
      .set(auth(token))
      .send({ isActive: false });
    expect(res.status).toBe(422);
  });

  it('a leader cannot edit other staff accounts', async () => {
    const leader = await signup('leader');
    const other = await signup('leader');
    const res = await request
      .patch(`/api/admin/users/${other.user.id}`)
      .set(auth(leader.token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('rejects editing a member through the admin endpoint', async () => {
    const token = await adminToken();
    const member = await signup('member');
    const res = await request
      .patch(`/api/admin/users/${member.user.id}`)
      .set(auth(token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });
});

describe('leaders manage member accounts', () => {
  it('a leader lists members with stats', async () => {
    const leader = await signup('leader');
    const member = await signup('member');
    const res = await request.get('/api/users/members').set(auth(leader.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.members)).toBe(true);
    const row = res.body.data.members.find((m) => m.email === member.email.toLowerCase());
    expect(row).toBeTruthy();
    expect(row).toHaveProperty('coursesCount');
    expect(row).toHaveProperty('quizzesTaken');
  });

  it('a leader views a member\'s full detail', async () => {
    const leader = await signup('leader');
    const member = await signup('member');
    const res = await request.get(`/api/users/members/${member.user.id}`).set(auth(leader.token));
    expect(res.status).toBe(200);
    expect(res.body.data.member.email).toBe(member.email.toLowerCase());
    expect(Array.isArray(res.body.data.courses)).toBe(true);
  });

  it('a leader edits a member and can deactivate/reactivate them', async () => {
    const leader = await signup('leader');
    const member = await signup('member');
    const edit = await request
      .patch(`/api/users/members/${member.user.id}`)
      .set(auth(leader.token))
      .send({ name: 'Renamed Member', memberNumber: 'GYMC/999' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.user.name).toBe('Renamed Member');
    expect(edit.body.data.user.memberNumber).toBe('GYMC/999');

    const off = await request
      .patch(`/api/users/members/${member.user.id}`)
      .set(auth(leader.token))
      .send({ isActive: false });
    expect(off.status).toBe(200);
    const blocked = await request.post('/api/auth/login').send({ identifier: member.email, password: DEFAULT_PASSWORD });
    expect(blocked.status).toBe(401);
  });

  it('a member cannot list or edit other members', async () => {
    const member = await signup('member');
    const other = await signup('member');
    const list = await request.get('/api/users/members').set(auth(member.token));
    expect(list.status).toBe(403);
    const edit = await request.patch(`/api/users/members/${other.user.id}`).set(auth(member.token)).send({ name: 'Nope' });
    expect(edit.status).toBe(403);
  });

  it('rejects editing a leader through the member-management endpoint', async () => {
    const leader = await signup('leader');
    const otherLeader = await signup('leader');
    const res = await request
      .patch(`/api/users/members/${otherLeader.user.id}`)
      .set(auth(leader.token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('rejects duplicate email/phone on edit', async () => {
    const leader = await signup('leader');
    const memberA = await signup('member');
    const memberB = await signup('member');
    const res = await request
      .patch(`/api/users/members/${memberB.user.id}`)
      .set(auth(leader.token))
      .send({ email: memberA.email });
    expect(res.status).toBe(409);
  });
});
