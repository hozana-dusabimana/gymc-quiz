import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { errors } from '../utils/response.js';
import { verifyFileToken } from '../lib/jwt.js';
import { getObjectBuffer, storageDriver } from '../lib/storage.js';

const router = Router();

// GET /files/:token  — serves a local-storage object for a signed, expiring token.
// (In production with R2 this route is unused; clients get signed R2 URLs.)
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    if (storageDriver() !== 'local') throw errors.notFound();
    let key;
    try {
      key = verifyFileToken(req.params.token);
    } catch {
      throw errors.unauthorized('Invalid or expired file link');
    }
    const buf = await getObjectBuffer(key).catch(() => null);
    if (!buf) throw errors.notFound('File not found');
    const name = key.split('/').pop();
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.setHeader('Content-Type', guessType(name));
    res.send(buf);
  }),
);

function guessType(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  return (
    {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain; charset=utf-8',
      md: 'text/markdown; charset=utf-8',
    }[ext] || 'application/octet-stream'
  );
}

export default router;
