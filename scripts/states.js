#!/usr/bin/env node
/** Viewport-sized captures of specific states, for eyeballing the design. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Use a prebuilt Chromium when CHROMIUM_PATH points at one; otherwise let
// Playwright resolve the browser it downloaded itself, which is what CI needs.
const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : {};

const FILE = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const OUT = path.join(__dirname, '..', '.shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions);

  const shot = async (name, { width, height, scheme, mobile }, steps) => {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: !!mobile, hasTouch: !!mobile,
      colorScheme: scheme, timezoneId: 'America/Vancouver'
    });
    const page = await ctx.newPage();
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    if (steps) await steps(page);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close();
  };

  const phone = { width: 390, height: 844, scheme: 'dark', mobile: true };
  const phoneLight = { ...phone, scheme: 'light' };
  const desk = { width: 1440, height: 900, scheme: 'dark' };
  const deskLight = { ...desk, scheme: 'light' };

  await shot('v-phone-hero', phone);
  await shot('v-phone-hero-light', phoneLight);
  await shot('v-phone-drawer', phone, async (p) => {
    await p.click('#burger');
    await p.waitForTimeout(400);
  });
  await shot('v-phone-prices', phone, async (p) => {
    await p.locator('#prices').scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
  });
  await shot('v-phone-visit', phone, async (p) => {
    await p.locator('#visit').scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
  });
  await shot('v-desk-hero', desk);
  await shot('v-desk-hero-light', deskLight);
  await shot('v-desk-prices', desk, async (p) => {
    await p.locator('#prices').scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
  });
  await shot('v-desk-work', deskLight, async (p) => {
    await p.locator('#work').scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
  });

  await browser.close();
  console.log('states: wrote captures to .shots/');
})();
