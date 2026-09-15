import { describe, it, expect } from 'vitest';
import * as storage from '../src/lib/storage.js';

/**
 * Storage: driver selection + the Cloudinary signed-URL contract.
 * A live upload/download round-trip is covered by the deploy smoke check once
 * real Cloudinary credentials are set on the server.
 */

describe('storage', () => {
  it('uses the local driver under test (no external network)', () => {
    expect(storage.storageDriver()).toBe('local');
  });

  it('local objectUrl is a signed, self-hosted /files link', async () => {
    const url = await storage.objectUrl('courses/abc/file.pdf');
    expect(url).toMatch(/\/files\/[\w.-]+$/);
  });

  it('cloudinaryConfigured() matches whether all three vars are present', async () => {
    const allSet = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    );
    expect(storage.cloudinaryConfigured()).toBe(allSet);
  });

  it('Cloudinary produces a time-limited signed raw download URL', async () => {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: 'demo',
      api_key: '123456789012345',
      api_secret: 'abcdefghijklmnopqrstuvwxyz012345',
      secure: true,
    });
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const url = cloudinary.utils.private_download_url('courses/x/1700-abc-notes.pdf', null, {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: expiresAt,
    });
    expect(url).toContain('api.cloudinary.com/v1_1/demo/raw/download');
    expect(url).toContain('public_id=courses%2Fx%2F1700-abc-notes.pdf');
    expect(url).toContain(`expires_at=${expiresAt}`);
    expect(url).toMatch(/[?&]signature=[a-f0-9]+/);
  });
});
