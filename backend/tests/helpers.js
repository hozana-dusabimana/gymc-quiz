import supertest from 'supertest';

// Force deterministic grading in CI (no external AI calls) unless explicitly enabled.
if (!process.env.RUN_AI_TESTS) process.env.OPENROUTER_API_KEY = '';
process.env.STORAGE_DRIVER = 'local';
process.env.MIS_SSO_SECRET = process.env.MIS_SSO_SECRET || 'test-mis-sso-secret';

const { createApp } = await import('../src/app.js');
export const app = createApp();
export const request = supertest(app);

let seq = 0;
export function uniqueEmail(role = 'user') {
  seq += 1;
  return `${role}.${Date.now()}.${seq}@vitest.local`;
}

export async function signup(role = 'member', name = `Test ${role}`) {
  const email = uniqueEmail(role);
  const reg = await request.post('/api/auth/register').send({ name, email, role });
  const code = reg.body?.data?.devCode;
  const login = await request.post('/api/auth/verify-otp').send({ email, code });
  return {
    email,
    token: login.body?.data?.accessToken,
    user: login.body?.data?.user,
    cookie: login.headers['set-cookie'],
  };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
