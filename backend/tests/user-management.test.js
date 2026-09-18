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

  it('an admin can demote another admin down to leader or member', async () => {
    const token = await adminToken();
    const other = await signup('admin');
    const toLeader = await request
      .patch(`/api/admin/users/${other.user.id}`)
      .set(auth(token))
      .send({ role: 'leader' });
    expect(toLeader.status).toBe(200);
    expect(toLeader.body.data.user.role).toBe('leader');

    const toMember = await request
      .patch(`/api/admin/users/${other.user.id}`)
      .set(auth(token))
      .send({ role: 'member' });
    expect(toMember.status).toBe(200);
    expect(toMember.body.data.user.role).toBe('member');
  });

  it('an admin cannot change their own role', async () => {
    const token = await adminToken();
    const me = await request.get('/api/auth/me').set(auth(token));
    const res = await request
      .patch(`/api/admin/users/${me.body.data.user.id}`)
      .set(auth(token))
      .send({ role: 'leader' });
    expect(res.status).toBe(422);
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

  it('a leader cannot promote a member to leader/admin', async () => {
    const leader = await signup('leader');
    const member = await signup('member');
    const res = await request
      .patch(`/api/users/members/${member.user.id}`)
      .set(auth(leader.token))
      .send({ role: 'leader' });
    expect(res.status).toBe(403);
  });

  it('an admin can promote a member to leader via the member-management endpoint', async () => {
    const token = await adminToken();
    const member = await signup('member');
    const res = await request
      .patch(`/api/users/members/${member.user.id}`)
      .set(auth(token))
      .send({ role: 'leader' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('leader');
  });
});

describe('an admin can see and manage everyone through /api/users/members', () => {
  it('lists members, leaders and admins alike', async () => {
    const token = await adminToken();
    const leader = await signup('leader');
    const member = await signup('member');
    const res = await request.get('/api/users/members').set(auth(token));
    expect(res.status).toBe(200);
    const emails = res.body.data.members.map((u) => u.email);
    expect(emails).toContain(leader.email.toLowerCase());
    expect(emails).toContain(member.email.toLowerCase());
    expect(res.body.data.members.some((u) => u.role === 'admin')).toBe(true);
  });

  it('a leader only sees members, not other leaders/admins', async () => {
    const leaderToken = (await signup('leader')).token;
    const otherLeader = await signup('leader');
    const res = await request.get('/api/users/members').set(auth(leaderToken));
    expect(res.status).toBe(200);
    expect(res.body.data.members.some((u) => u.email === otherLeader.email.toLowerCase())).toBe(false);
    expect(res.body.data.members.every((u) => u.role === 'member')).toBe(true);
  });

  it('an admin can open and edit another admin\'s detail/profile here', async () => {
    const token = await adminToken();
    const other = await signup('admin');
    const detail = await request.get(`/api/users/members/${other.user.id}`).set(auth(token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.member.role).toBe('admin');

    const edit = await request
      .patch(`/api/users/members/${other.user.id}`)
      .set(auth(token))
      .send({ name: 'Renamed Admin' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.user.name).toBe('Renamed Admin');
  });

  it('an admin cannot deactivate or change their own role here', async () => {
    const token = await adminToken();
    const me = await request.get('/api/auth/me').set(auth(token));

    const deactivate = await request
      .patch(`/api/users/members/${me.body.data.user.id}`)
      .set(auth(token))
      .send({ isActive: false });
    expect(deactivate.status).toBe(422);

    const changeRole = await request
      .patch(`/api/users/members/${me.body.data.user.id}`)
      .set(auth(token))
      .send({ role: 'leader' });
    expect(changeRole.status).toBe(422);
  });

  it('a leader still cannot reach a leader/admin account here, even for viewing', async () => {
    const leaderToken = (await signup('leader')).token;
    const otherAdmin = await signup('admin');
    const res = await request.get(`/api/users/members/${otherAdmin.user.id}`).set(auth(leaderToken));
    expect(res.status).toBe(404);
  });
});
