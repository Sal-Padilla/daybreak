// Daybreak — dev-server.mjs — zero-dependency static server for local testing
//
//   node dev-server.mjs            -> serves this folder on http://localhost:8123
//   node dev-server.mjs 8080       -> pick a port
//
// You need a real server (not file://) because the app uses ES modules and a
// service worker, both of which browsers block on the file:// protocol.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2]) || 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

    // Contain the path inside ROOT — no directory traversal.
    const target = normalize(join(ROOT, rel));
    if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`404 — ${rel}`);
      console.log(`  404  ${rel}`);
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      // Never cache during development, or the service worker will hide your edits.
      'cache-control': 'no-store, must-revalidate',
      'service-worker-allowed': '/',
    }).end(body);
    console.log(`  200  ${rel}`);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'text/plain' }).end('500 — ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Daybreak dev server`);
  console.log(`  serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}\n`);
});
