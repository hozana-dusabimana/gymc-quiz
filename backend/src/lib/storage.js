import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { signFileToken } from './jwt.js';

/**
 * Object storage with pluggable drivers, chosen by STORAGE_DRIVER:
 *   - 'cloudinary' : Cloudinary raw (authenticated) — production default when configured
 *   - 'r2'         : Cloudflare R2 (S3 API)
 *   - 'local'      : filesystem under STORAGE_LOCAL_DIR — dev / fallback
 *
 * Every driver implements: ensureReady, uploadObject({key,body,contentType}),
 * objectUrl(key, expiresIn), getObjectBuffer(key), deleteObject(key).
 */

function detectDriver() {
  if (env.isTest) return 'local'; // the suite never touches external storage
  if (process.env.STORAGE_DRIVER) return process.env.STORAGE_DRIVER;
  if (cloudinaryConfigured()) return 'cloudinary';
  if (r2Configured()) return 'r2';
  return 'local';
}
const DRIVER = detectDriver();

export function storageDriver() {
  return DRIVER;
}
export function cloudinaryConfigured() {
  return Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
}
export function r2Configured() {
  return Boolean(env.r2.endpoint && env.r2.accessKeyId && env.r2.secretAccessKey);
}

// ---------------------------------------------------------------------------
// local
// ---------------------------------------------------------------------------
const LOCAL_DIR = process.env.STORAGE_LOCAL_DIR
  ? path.resolve(process.env.STORAGE_LOCAL_DIR)
  : path.join(env.repoRoot, 'backend/.storage');

const localDriver = {
  async ensureReady() {
    await mkdir(LOCAL_DIR, { recursive: true });
  },
  async uploadObject({ key, body }) {
    const dest = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return { key, url: await this.objectUrl(key) };
  },
  async objectUrl(key) {
    return `${env.publicUrl}/files/${encodeURIComponent(signFileToken(key))}`;
  },
  async getObjectBuffer(key) {
    return readFile(path.join(LOCAL_DIR, key));
  },
  async deleteObject(key) {
    await unlink(path.join(LOCAL_DIR, key)).catch(() => {});
  },
};

// ---------------------------------------------------------------------------
// r2 (S3)
// ---------------------------------------------------------------------------
let s3Client = null;
async function s3() {
  if (s3Client) return s3Client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: 'auto',
    endpoint: env.r2.endpoint,
    credentials: { accessKeyId: env.r2.accessKeyId, secretAccessKey: env.r2.secretAccessKey },
    forcePathStyle: true,
  });
  return s3Client;
}

const r2Driver = {
  async ensureReady() {
    const { HeadBucketCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
    const c = await s3();
    try {
      await c.send(new HeadBucketCommand({ Bucket: env.r2.bucket }));
    } catch {
      await c.send(new CreateBucketCommand({ Bucket: env.r2.bucket }));
    }
  },
  async uploadObject({ key, body, contentType }) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await s3()).send(
      new PutObjectCommand({ Bucket: env.r2.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { key, url: await this.objectUrl(key) };
  },
  async objectUrl(key, expiresIn = 3600) {
    if (env.r2.publicBaseUrl) return `${env.r2.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    return getSignedUrl(await s3(), new GetObjectCommand({ Bucket: env.r2.bucket, Key: key }), {
      expiresIn,
    });
  },
  async getObjectBuffer(key) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const res = await (await s3()).send(new GetObjectCommand({ Bucket: env.r2.bucket, Key: key }));
    const chunks = [];
    for await (const c of res.Body) chunks.push(c);
    return Buffer.concat(chunks);
  },
  async deleteObject(key) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await s3()).send(new DeleteObjectCommand({ Bucket: env.r2.bucket, Key: key }));
  },
};

// ---------------------------------------------------------------------------
// cloudinary (raw, authenticated)
// ---------------------------------------------------------------------------
let cld = null;
async function cloudinary() {
  if (cld) return cld;
  const mod = await import('cloudinary');
  cld = mod.v2;
  cld.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  return cld;
}

// For raw assets Cloudinary keeps the extension inside the public_id, so the
// storage key (e.g. "courses/x/123-abc-notes.pdf") is used verbatim throughout.
const cloudinaryDriver = {
  async ensureReady() {
    await cloudinary();
  },
  async uploadObject({ key, body }) {
    const c = await cloudinary();
    await new Promise((resolve, reject) => {
      const stream = c.uploader.upload_stream(
        { resource_type: 'raw', type: 'authenticated', public_id: key, overwrite: true, invalidate: true },
        (err, res) => (err ? reject(err) : resolve(res)),
      );
      stream.end(body);
    });
    return { key, url: await this.objectUrl(key) };
  },
  async objectUrl(key, expiresIn = 3600) {
    const c = await cloudinary();
    // Signed, time-limited download URL for an authenticated raw asset.
    return c.utils.private_download_url(key, null, {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    });
  },
  async getObjectBuffer(key) {
    const url = await this.objectUrl(key, 120);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cloudinary fetch ${res.status} for ${key}`);
    return Buffer.from(await res.arrayBuffer());
  },
  async deleteObject(key) {
    const c = await cloudinary();
    await c.uploader.destroy(key, { resource_type: 'raw', type: 'authenticated', invalidate: true });
  },
};

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------
const drivers = { local: localDriver, r2: r2Driver, cloudinary: cloudinaryDriver };
const active = drivers[DRIVER] || localDriver;

export const ensureBucket = () => active.ensureReady();
export const uploadObject = (args) => active.uploadObject(args);
export const objectUrl = (key, expiresIn) => active.objectUrl(key, expiresIn);
export const getObjectBuffer = (key) => active.getObjectBuffer(key);
export const deleteObject = (key) => active.deleteObject(key);
