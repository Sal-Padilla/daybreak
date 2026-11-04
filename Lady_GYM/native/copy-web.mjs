// Lady_GYM — native/copy-web.mjs — copies the web app into ./www for Capacitor to bundle.
// The web app is the single source; the native shell only wraps it. Run via `npm run sync`.

import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const APP = fileURLToPath(new URL('..', import.meta.url));
const WWW = fileURLToPath(new URL('./www', import.meta.url));

rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
for (const item of ['index.html', 'get.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons']) {
  cpSync(join(APP, item), join(WWW, item), { recursive: true });
}
console.log('Copied the web app into', WWW);
