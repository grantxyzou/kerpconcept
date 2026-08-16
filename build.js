#!/usr/bin/env node
/**
 * Inlines the CSS and JS into a single self-contained page.
 *
 *   dist/index.html    full document — drop on any static host
 *   dist/artifact.html title + <style> + body content, for the Artifact wrapper
 *
 * No dependencies, no watch mode. Run `node build.js`.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const css = read('assets/css/kerp.css');
const js = read('assets/js/kerp.js');

const inlined = html
  .replace(
    /\s*<link rel="stylesheet" href="assets\/css\/kerp\.css">/,
    `\n<style>\n${css}\n</style>`
  )
  .replace(
    /\s*<script src="assets\/js\/kerp\.js"><\/script>/,
    `\n<script>\n${js}\n</script>`
  );

// Only the stylesheet and script are inlined. Image references are expected to
// survive, and are served from the copied assets/img alongside the bundle.
if (inlined.includes('assets/css/') || inlined.includes('assets/js/')) {
  console.error('build: a stylesheet or script reference survived inlining — check the paths in index.html');
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), inlined);

// Photos cannot be inlined without bloating the bundle, so copy them next to it
// and keep the relative paths working.
const imgSrc = path.join(root, 'assets/img');
const imgOut = path.join(root, 'dist/assets/img');
fs.rmSync(imgOut, { recursive: true, force: true });
if (fs.existsSync(imgSrc)) {
  fs.mkdirSync(imgOut, { recursive: true });
  const photos = fs.readdirSync(imgSrc).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));
  photos.forEach((f) => fs.copyFileSync(path.join(imgSrc, f), path.join(imgOut, f)));
  console.log(`build: copied ${photos.length} photo(s) into dist/assets/img`);
}

// The Artifact host supplies <!doctype>, <html>, <head> and <body>, so hand it
// the title, the style block and the body contents only.
const title = inlined.match(/<title>([\s\S]*?)<\/title>/)[1];
const style = inlined.match(/<style>[\s\S]*?<\/style>/)[0];
const body = inlined.match(/<body>([\s\S]*)<\/body>/)[1];

fs.writeFileSync(
  path.join(root, 'dist/artifact.html'),
  `<title>${title}</title>\n${style}\n${body.trim()}\n`
);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' kB';
console.log(`build: dist/index.html    ${kb(inlined)}`);
console.log(`build: dist/artifact.html ${kb(style + body)}`);
