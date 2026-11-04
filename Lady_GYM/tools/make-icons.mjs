// Lady_GYM — tools/make-icons.mjs — draws the app icon and iPhone launch screens, then renders the PNGs.
//
//   node tools/make-icons.mjs
//
// Needs Playwright's Chromium (pre-installed in the build environment). The icon is the same
// illustrated woman as the rest of the app, in white, on the sunrise gradient — so the Home
// Screen icon says "women's training" before anyone reads the name.

import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { poseMarkup } from '../js/art/figure.js';
import { POSES, welcomeArt } from '../js/art/scenes.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'icons');
mkdirSync(OUT, { recursive: true });

const WHITE = { skin: '#FFFFFF', hair: '#FFFFFF', top: '#FFFFFF', legs: '#FFFFFF', shoe: '#FFFFFF', style: 0, panel: ['#fff', '#fff'] };

function iconSvg({ inset = 0 } = {}) {
  // inset shrinks the artwork toward the centre for the Android "maskable" safe zone
  const s = 1 - inset;
  // A clean silhouette: every shade and detail flattened to white, the blush removed.
  const fig = poseMarkup(POSES.press, WHITE)
    .replace(/<circle[^>]*opacity="\.55"[^>]*\/>/g, '')
    .replace(/#[0-9a-fA-F]{6}/g, '#FFFFFF')
    // bolder strokes, so the figure still reads at 60 px on a Home Screen
    .replace(/stroke-width="([\d.]+)"/g, (m, w) => 'stroke-width="' + (parseFloat(w) * 1.55).toFixed(1) + '"')
    .replace(/r="([\d.]+)" fill="#FFFFFF"\/>/g, (m, r) => 'r="' + (parseFloat(r) * 1.12).toFixed(1) + '" fill="#FFFFFF"/>');
  const bells = '<g fill="#FFFFFF"><rect x="54" y="2.5" width="16" height="7" rx="3"/><rect x="30" y="2.5" width="16" height="7" rx="3"/></g>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#FF3D86"/><stop offset=".55" stop-color="#FF6F73"/><stop offset="1" stop-color="#FFB35E"/>' +
    '</linearGradient></defs>' +
    '<rect width="1024" height="1024" fill="url(#g)"/>' +
    '<g transform="translate(512 512) scale(' + s + ') translate(-512 -512)">' +
      '<circle cx="512" cy="560" r="300" fill="#FFFFFF" opacity=".18"/>' +
      '<circle cx="512" cy="560" r="210" fill="#FFFFFF" opacity=".14"/>' +
      '<g transform="translate(512 540) scale(6.6) translate(-50 -56)">' + bells + fig + '</g>' +
      '<rect x="262" y="890" width="500" height="26" rx="13" fill="#FFFFFF" opacity=".5"/>' +
    '</g></svg>';
}

function splashHtml(w, h) {
  const icon = Math.round(Math.min(w, h) * 0.28);
  return '<html><body style="margin:0;width:' + w + 'px;height:' + h + 'px;background:#FF5A86;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;font-family:-apple-system,system-ui,sans-serif">' +
    '<div style="width:' + icon + 'px;height:' + icon + 'px;border-radius:' + Math.round(icon * 0.225) + 'px;overflow:hidden;' +
    'box-shadow:0 ' + Math.round(icon * 0.06) + 'px ' + Math.round(icon * 0.2) + 'px rgba(120,0,40,.25)">' + iconSvg() + '</div>' +
    '<div style="color:#fff;font-weight:800;font-size:' + Math.round(icon * 0.26) + 'px;margin-top:' + Math.round(icon * 0.22) + 'px;' +
    'letter-spacing:-.01em">Lady_GYM</div></body></html>';
}

const SPLASH = [
  [1320, 2868], [1290, 2796], [1284, 2778], [1206, 2622], [1179, 2556], [1170, 2532],
  [1242, 2688], [828, 1792], [1125, 2436], [750, 1334],
];

writeFileSync(join(OUT, 'icon.svg'), iconSvg());
writeFileSync(join(OUT, 'icon-maskable.svg'), iconSvg({ inset: 0.2 }));

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();

async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent('<html><body style="margin:0">' + svg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ') + '</body></html>');
  await page.screenshot({ path: join(OUT, file), omitBackground: false });
}

for (const [size, file] of [[32, 'icon-32.png'], [180, 'icon-180.png'], [192, 'icon-192.png'], [512, 'icon-512.png'], [1024, 'icon-1024.png']]) {
  await png(iconSvg(), size, file);
}
await png(iconSvg({ inset: 0.2 }), 512, 'icon-maskable-512.png');

for (const [w, h] of SPLASH) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(splashHtml(w, h));
  await page.screenshot({ path: join(OUT, 'splash-' + w + 'x' + h + '.png') });
}

// The picture that appears when the invite link is pasted into Messages, WhatsApp or Mail.
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent('<html><body style="margin:0;width:1200px;height:630px;display:flex;' +
  'font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#FF5A86;overflow:hidden">' +
  '<div style="width:640px;height:630px;flex:none">' + welcomeArt().replace('<svg ', '<svg width="640" height="630" preserveAspectRatio="xMidYMid slice" ') + '</div>' +
  '<div style="flex:1;padding:70px 56px;color:#fff;display:flex;flex-direction:column;justify-content:center;' +
  'background:linear-gradient(160deg,#D3125E,#B8145E)">' +
  '<div style="width:110px;height:110px;border-radius:25px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
  iconSvg().replace('<svg ', '<svg width="110" height="110" ') + '</div>' +
  '<div style="font-size:62px;font-weight:900;margin-top:28px;letter-spacing:-1px">Lady_GYM</div>' +
  '<div style="font-size:31px;font-weight:600;line-height:1.3;margin-top:12px">Workouts made for women,<br>a picture for every move.</div>' +
  '<div style="font-size:24px;font-weight:700;margin-top:26px;background:rgba(255,255,255,.2);border-radius:999px;' +
  'padding:10px 20px;align-self:flex-start;white-space:nowrap">Free · no App Store needed</div>' +
  '</div></body></html>');
await page.screenshot({ path: join(OUT, 'share-card.jpg'), type: 'jpeg', quality: 86 });

await browser.close();
console.log('icons written to', OUT);
