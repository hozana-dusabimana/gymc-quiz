import supertest from 'supertest';

// Force deterministic grading in CI (no external AI calls) unless explicitly enabled.
if (!process.env.RUN_AI_TESTS) process.env.OPENROUTER_API_KEY = '';
process.env.STORAGE_DRIVER = 'local';

const { createApp } = await import('../src/app.js');
export const app = createApp();
export const request = supertest(app);

let seq = 0;
export function uniqueEmail(role = 'user') {
  seq += 1;
  return `${role}.${Date.now()}.${seq}@vitest.local`;
}
export function uniquePhone() {
  seq += 1;
  return `07${String(Date.now()).slice(-8)}${String(seq).padStart(2, '0')}`;
}

export const DEFAULT_PASSWORD = 'Vitest@1234';
export const ADMIN_EMAIL = 'gymc@gmail.com';
export const ADMIN_PASSWORD = 'GYMC@123';

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

let adminTokenPromise = null;
/** The seeded admin's access token (logged in once, reused across tests). */
export async function adminToken() {
  if (!adminTokenPromise) {
    adminTokenPromise = request
      .post('/api/auth/login')
      .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .then((res) => res.body?.data?.accessToken);
  }
  return adminTokenPromise;
}

/**
 * Create and log in a test account. Members self-register; leaders/admins
 * are created via the admin-only endpoint (as production requires) and then
 * log in normally — this exercises the real gate, not a test-only shortcut.
 */
export async function signup(role = 'member', name = `Test ${role}`) {
  const email = uniqueEmail(role);
  const phone = uniquePhone();

  if (role === 'member') {
    const reg = await request
      .post('/api/auth/register')
      .send({ name, email, phone, password: DEFAULT_PASSWORD });
    return {
      email,
      phone,
      token: reg.body?.data?.accessToken,
      user: reg.body?.data?.user,
      cookie: reg.headers['set-cookie'],
    };
  }

  const token = await adminToken();
  await request
    .post('/api/admin/users')
    .set(auth(token))
    .send({ name, email, phone, role, password: DEFAULT_PASSWORD });
  const login = await request.post('/api/auth/login').send({ identifier: email, password: DEFAULT_PASSWORD });
  return {
    email,
    phone,
    token: login.body?.data?.accessToken,
    user: login.body?.data?.user,
    cookie: login.headers['set-cookie'],
  };
}
