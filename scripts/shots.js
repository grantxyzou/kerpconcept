#!/usr/bin/env node
/**
 * Renders the built page at three viewports in both themes, then reports
 * console errors and any horizontal overflow. Output lands in .shots/.
 *
 *   node build.js && node scripts/shots.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const OUT = path.join(__dirname, '..', '.shots');

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: false },
  { name: 'desktop', width: 1440, height: 900, mobile: false }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failures = 0;

  for (const vp of VIEWPORTS) {
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        colorScheme: scheme,
        timezoneId: 'America/Vancouver'
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.goto(FILE, { waitUntil: 'load' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(700);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);

      const overflow = await page.evaluate(() => {
        const docW = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > docW + 1)
          .map((el) => el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]);
        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: docW,
          wide: [...new Set(wide)].slice(0, 8)
        };
      });

      const status = await page.textContent('#status .status__text');
      const tag = `${vp.name}-${scheme}`;
      await page.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: true });

      const bad = overflow.scrollW > overflow.clientW + 1 || errors.length;
      if (bad) failures++;
      console.log(
        `${bad ? 'FAIL' : 'ok  '} ${tag.padEnd(16)} scrollW=${overflow.scrollW} clientW=${overflow.clientW}` +
        `${overflow.wide.length ? ' wide=' + overflow.wide.join(',') : ''}` +
        `${errors.length ? ' errors=' + errors.join(' | ') : ''}` +
        `  status="${status.trim()}"`
      );
      await ctx.close();
    }
  }

  await browser.close();
  process.exit(failures ? 1 : 0);
})();
