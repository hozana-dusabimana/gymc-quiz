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

export async function signup(role = 'member', name = `Test ${role}`) {
  const email = uniqueEmail(role);
  const phone = uniquePhone();
  const reg = await request
    .post('/api/auth/register')
    .send({ name, email, phone, role, password: DEFAULT_PASSWORD });
  return {
    email,
    phone,
    token: reg.body?.data?.accessToken,
    user: reg.body?.data?.user,
    cookie: reg.headers['set-cookie'],
  };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
