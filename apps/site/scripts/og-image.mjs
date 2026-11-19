// Renders the social preview image (static/og.png, 1200×630) and the square logo
// (static/logo.png, 512×512) with the site's own font and colours. Run after a brand or
// tagline change: node scripts/og-image.mjs. The outputs are committed.
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
// Embedded as a data URL: a page made with setContent may not load file:// fonts.
const font = `data:font/woff2;base64,${readFileSync(
	require.resolve('@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2')
).toString('base64')}`;
const mark = (size) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#1f4fd1"/><path d="M8 6.5v11M8 12l6.5-5.5M10.2 10.2 15.5 17.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const base = `<style>@font-face{font-family:Plex;src:url(${font});font-weight:100 700}
*{margin:0;box-sizing:border-box}body{font-family:Plex,sans-serif;color:#121412;background:#fff}</style>`;

const og = `${base}<body style="width:1200px;height:630px;padding:88px 96px;display:flex;flex-direction:column;justify-content:space-between;border-bottom:12px solid #1f4fd1">
<div style="display:flex;align-items:center;gap:20px;font-size:44px;font-weight:600;letter-spacing:-0.01em">${mark(56)}Kofra</div>
<div><div style="font-size:68px;font-weight:600;line-height:1.08;letter-spacing:-0.02em;max-width:900px">S3-compatible cloud storage</div>
<div style="margin-top:28px;font-size:32px;color:#3f423d">One price per TB. Works with aws-cli, rclone and restic.</div></div>
<div style="font-size:26px;color:#5f625c">kofra.app</div></body>`;
const logo = `${base}<body style="width:512px;height:512px;display:grid;place-items:center">${mark(512)}</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [html, file, w, h] of [
	[og, 'static/og.png', 1200, 630],
	[logo, 'static/logo.png', 512, 512]
]) {
	await page.setViewportSize({ width: w, height: h });
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.load('600 40px Plex'));
	await page.evaluate(() => document.fonts.ready);
	const loaded = await page.evaluate(() => document.fonts.check('600 40px Plex'));
	if (!loaded) throw new Error('IBM Plex Sans did not load');
	await page.screenshot({ path: path.resolve(file), clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();
console.log('wrote static/og.png and static/logo.png');
