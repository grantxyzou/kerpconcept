#!/usr/bin/env node
/**
 * Accessibility audit. Runs axe-core (WCAG 2.0/2.1 A + AA) over the built page
 * at mobile and desktop widths, in both themes, and again with the mobile
 * drawer open — an overlay axe cannot see in its default state.
 *
 * Also checks two things axe cannot: that every interactive element meets the
 * 44x44 CSS px target size (WCAG 2.5.5 AAA / 2.5.8 AA), and that keyboard
 * focus is actually visible on each focusable element.
 *
 *   node build.js && node scripts/a11y.js
 *
 * Exits non-zero on any violation.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const path = require('path');

// Use a prebuilt Chromium when CHROMIUM_PATH points at one; otherwise let
// Playwright resolve the browser it downloaded itself, which is what CI needs.
const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : {};

const FILE = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const CASES = [
  { name: 'mobile  light', width: 390, height: 844, scheme: 'light', mobile: true },
  { name: 'mobile  dark', width: 390, height: 844, scheme: 'dark', mobile: true },
  { name: 'desktop light', width: 1440, height: 900, scheme: 'light', mobile: false },
  { name: 'desktop dark', width: 1440, height: 900, scheme: 'dark', mobile: false },
  { name: 'drawer  light', width: 390, height: 844, scheme: 'light', mobile: true, drawer: true },
  { name: 'drawer  dark', width: 390, height: 844, scheme: 'dark', mobile: true, drawer: true }
];

// Minimum target size. 24px is the WCAG 2.2 AA floor (2.5.8); 44px is the AAA
// bar (2.5.5) and the one that actually matters on a phone.
const TARGET_MIN = 44;

(async () => {
  const browser = await chromium.launch(launchOptions);
  let violations = 0;

  for (const c of CASES) {
    const ctx = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      isMobile: c.mobile,
      hasTouch: c.mobile,
      colorScheme: c.scheme,
      timezoneId: 'America/Vancouver'
    });
    const page = await ctx.newPage();
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    if (c.drawer) {
      await page.click('#burger');
      await page.waitForTimeout(300);
    } else {
      // Reveal animations start elements at opacity 0, which axe reads as
      // hidden. Scroll the whole page so everything is in its final state.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
    }

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    const label = c.name.padEnd(14);
    if (results.violations.length === 0) {
      console.log(`  PASS  ${label} axe: 0 violations (${results.passes.length} checks passed)`);
    } else {
      violations += results.violations.length;
      console.log(`  FAIL  ${label} axe: ${results.violations.length} violation(s)`);
      for (const v of results.violations) {
        console.log(`          [${v.impact}] ${v.id} — ${v.help}`);
        for (const n of v.nodes.slice(0, 4)) {
          console.log(`            ${n.target.join(' ')}`);
          const detail = (n.failureSummary || '').split('\n').filter(Boolean).slice(1, 3);
          detail.forEach((d) => console.log(`              ${d.trim()}`));
        }
      }
    }

    // --- target size, on the states axe does not measure -------------------
    const small = await page.evaluate((min) => {
      const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return [...document.querySelectorAll(sel)]
        .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().split(' ')[0],
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
            w: Math.round(r.width),
            h: Math.round(r.height)
          };
        })
        .filter((x) => x.w > 0 && (x.h < min || x.w < min));
    }, TARGET_MIN);

    if (small.length === 0) {
      console.log(`        ${label} targets: all >= ${TARGET_MIN}px`);
    } else {
      violations += small.length;
      console.log(`  FAIL  ${label} targets: ${small.length} under ${TARGET_MIN}px`);
      small.forEach((s) => console.log(`          ${s.tag}.${s.cls} "${s.text}" ${s.w}x${s.h}`));
    }

    // --- focus visibility --------------------------------------------------
    // Must be driven by real Tab presses: :focus-visible only matches when the
    // focus came from the keyboard, so a programmatic el.focus() would report
    // every element as unstyled.
    const noFocusRing = [];
    const dimFocusRing = [];
    await page.evaluate(() => document.body.focus());
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // Track the element itself, not its label. Two different buttons can
        // both say "Book online", and de-duplicating by text made the walk stop
        // at the second one — before ever reaching the closing band.
        if (el.dataset.a11ySeen) return { wrapped: true };
        el.dataset.a11ySeen = '1';
        const s = getComputedStyle(el);

        // Resolve any CSS colour through a canvas rather than by regex. Chrome
        // computes color-mix() to `color(srgb 0.97 0.96 0.96 / 0.88)` — 0-1
        // floats, not 0-255 — so string parsing silently reads near-white as
        // near-black. Reading a painted pixel back handles every syntax.
        const cv = document.createElement('canvas');
        cv.width = cv.height = 1;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        const parse = (c) => {
          if (!c) return null;
          cx.clearRect(0, 0, 1, 1);
          cx.fillStyle = 'rgba(0,0,0,0)';
          cx.fillStyle = c;
          cx.fillRect(0, 0, 1, 1);
          const d = cx.getImageData(0, 0, 1, 1).data;
          return d[3] === 0 ? null : [d[0], d[1], d[2]];
        };
        const lum = ([r, g, b]) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };

        // outline-offset is positive, so the ring is drawn outside the element's
        // own box — it sits on whatever ancestor paints the background behind it.
        let bg = null;
        for (let n = el.parentElement; n && !bg; n = n.parentElement) {
          bg = parse(getComputedStyle(n).backgroundColor);
        }
        const ring = parse(s.outlineColor);

        return {
          key: (el.className || '').toString().split(' ')[0] + '|' +
               (el.textContent || '').trim().slice(0, 20),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
          shadow: s.boxShadow !== 'none',
          contrast: ring && bg ? ratio(ring, bg) : null,
          ringColor: s.outlineColor
        };
      });
      if (!info || info.wrapped) break;
      const label = info.key.replace('|', ' / ');
      if (!info.outline && !info.shadow) {
        noFocusRing.push(label);
      } else if (info.outline && info.contrast !== null && info.contrast < 3) {
        // WCAG 2.4.11 wants the focus indicator to stand out from its backdrop.
        // A red ring on a red band passes a presence check and is still invisible.
        dimFocusRing.push(`${label} (${info.contrast.toFixed(2)}:1, ${info.ringColor})`);
      }
    }

    await page.evaluate(() =>
      document.querySelectorAll('[data-a11y-seen]').forEach((n) => delete n.dataset.a11ySeen));

    if (noFocusRing.length === 0 && dimFocusRing.length === 0) {
      console.log(`        ${label} focus: visible and >= 3:1 on every focusable element`);
    } else {
      violations += noFocusRing.length + dimFocusRing.length;
      if (noFocusRing.length) {
        console.log(`  FAIL  ${label} focus: ${noFocusRing.length} without a visible indicator`);
        noFocusRing.forEach((f) => console.log(`          ${f}`));
      }
      if (dimFocusRing.length) {
        console.log(`  FAIL  ${label} focus: ${dimFocusRing.length} ring(s) under 3:1 against the backdrop`);
        dimFocusRing.forEach((f) => console.log(`          ${f}`));
      }
    }

    await ctx.close();
  }

  await browser.close();
  console.log(violations ? `\n${violations} issue(s) found.` : '\nAll accessibility checks passed.');
  process.exit(violations ? 1 : 0);
})();
