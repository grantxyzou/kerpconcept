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
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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
    const seen = new Set();
    await page.evaluate(() => document.body.focus());
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          key: (el.className || '').toString().split(' ')[0] + '|' +
               (el.textContent || '').trim().slice(0, 20),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
          shadow: s.boxShadow !== 'none',
          border: s.borderColor
        };
      });
      if (!info) break;
      if (seen.has(info.key)) break; // wrapped around
      seen.add(info.key);
      if (!info.outline && !info.shadow) noFocusRing.push(info.key.replace('|', ' — '));
    }

    if (noFocusRing.length === 0) {
      console.log(`        ${label} focus: visible on every focusable element`);
    } else {
      violations += noFocusRing.length;
      console.log(`  FAIL  ${label} focus: ${noFocusRing.length} without a visible indicator`);
      noFocusRing.forEach((f) => console.log(`          ${f}`));
    }

    await ctx.close();
  }

  await browser.close();
  console.log(violations ? `\n${violations} issue(s) found.` : '\nAll accessibility checks passed.');
  process.exit(violations ? 1 : 0);
})();
