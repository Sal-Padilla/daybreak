// Local static server for testing. Not shipped to Pages.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = 8777;
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml',
  '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json', '.ico':'image/x-icon' };

createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/daybreak/')) p = p.slice('/daybreak'.length);
  if (p === '/' || p === '') p = '/index.html';
  const file = join(ROOT, normalize(p).replace(/^(\.\.[/\])+/, ''));
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 ' + p);
  }
}).listen(PORT, () => console.log('daybreak on http://localhost:' + PORT));
