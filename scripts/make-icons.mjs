// Rendert public/favicon.svg naar PNG-iconen (Playwright/Chromium).
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import fs from 'node:fs'
const svg = fs.readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  // Maskable: geen afgeronde hoeken en extra marge (veilige zone).
  const inner = maskable ? svg.replace('rx="112"', 'rx="0"').replace('viewBox="0 0 512 512"', 'viewBox="-80 -80 672 672"').replace('<rect width="512" height="512"', '<rect x="-80" y="-80" width="672" height="672"') : svg
  await page.setContent(`<html><body style="margin:0;background:${maskable ? '#292c3d' : 'transparent'}">${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: !maskable })
  console.log(file)
}
await render(192, 'pwa-192.png')
await render(512, 'pwa-512.png')
await render(512, 'pwa-maskable-512.png', { maskable: true })
// iOS rondt zelf af en wil geen transparantie.
await page.setViewportSize({ width: 180, height: 180 })
await page.setContent(`<html><body style="margin:0;background:#292c3d">${svg.replace('rx="112"', 'rx="0"').replace('<svg ', '<svg width="180" height="180" ')}</body></html>`)
await page.screenshot({ path: new URL('../public/apple-touch-icon.png', import.meta.url).pathname })
console.log('apple-touch-icon.png')
await browser.close()
