/* Minimal zero-dependency static server for the built SPA (production).
 * Serves ./dist, falls back to index.html for client-side routes.
 * Usage: node serve.js [port]   (default 8194)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 8194);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

async function send(res, filePath, status = 200) {
  const body = await readFile(filePath);
  const ext = extname(filePath);
  const immutable = filePath.includes(`${join('', 'assets')}`) || /\/assets\//.test(filePath);
  res.writeHead(status, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(url).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(DIST, rel);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) filePath = join(filePath, 'index.html');
      await send(res, filePath);
      return;
    } catch {
      // SPA fallback
      await send(res, join(DIST, 'index.html'), 200);
    }
  } catch (err) {
    res.writeHead(500).end('Internal error');
    // eslint-disable-next-line no-console
    console.error(err);
  }
}).listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[gymc-web] serving ${DIST} on http://127.0.0.1:${PORT}`);
});
