import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

// Capture the runtime's NODE_ENV before dotenv (which uses override:true for
// secrets) can clobber it, then restore it so `NODE_ENV=test` always wins.
const runtimeNodeEnv = process.env.NODE_ENV;

// Root .env is the canonical secrets file for the whole monorepo.
// A backend/.env may override it locally (also gitignored).
for (const file of [path.join(repoRoot, '.env'), path.join(repoRoot, 'backend/.env')]) {
  if (existsSync(file)) dotenv.config({ path: file, override: true });
}
if (runtimeNodeEnv) process.env.NODE_ENV = runtimeNodeEnv;

const isTest = process.env.NODE_ENV === 'test';

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    if (isTest) return '';
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  repoRoot,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  port: Number(process.env.BACKEND_PORT || 4000),
  publicUrl: process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.BACKEND_PORT || 4000}`,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Public origin of the web app (for building links sent to users / other systems).
  webUrl: (
    process.env.WEB_PUBLIC_URL ||
    (process.env.CORS_ORIGINS || '').split(',')[0] ||
    'http://localhost:3000'
  ).trim().replace(/\/$/, ''),

  databaseUrl: isTest
    ? required('TEST_DATABASE_URL', process.env.DATABASE_URL)
    : required('DATABASE_URL'),

  jwt: {
    secret: required('JWT_SECRET', isTest ? 'test-secret' : undefined),
    accessTtl: process.env.JWT_ACCESS_TTL || '30m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '30d',
  },

  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
    debugLog: process.env.OTP_DEBUG_LOG === 'true',
    exposeDevCode: process.env.OTP_EXPOSE_DEV_CODE === 'true',
  },

  ai: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash-lite',
    webModel: process.env.OPENROUTER_WEB_MODEL || 'openai/gpt-4o-mini',
    appUrl: process.env.OPENROUTER_APP_URL || 'http://localhost:3000',
    appTitle: process.env.OPENROUTER_APP_TITLE || 'Gisozi Youth Mass Choir Quiz',
  },

  embedding: {
    model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
    dim: Number(process.env.EMBEDDING_DIM || 384),
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    endpoint: process.env.R2_ENDPOINT || '',
    bucket: process.env.R2_BUCKET || 'gymc-quiz-materials',
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'gymc-quiz',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'GYMC Quiz <no-reply@gymc-quiz.local>',
  },

  uploads: {
    maxBytes: Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024),
    allowedTypes: ['pdf', 'docx', 'pptx', 'txt', 'md'],
  },
};

export function aiConfigured() {
  return Boolean(env.ai.apiKey);
}

export function storageConfigured() {
  const r2 = env.r2.endpoint && env.r2.accessKeyId && env.r2.secretAccessKey;
  const cld = env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret;
  return Boolean(r2 || cld);
}

export function emailConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}
