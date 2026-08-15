# kerp.ca — redesign proof of concept

A mobile-first redesign of [kerp.ca](https://kerp.ca), the site for **Kerp Barbershop &
Salon** at 524 W Pender St in downtown Vancouver. Single page, no framework, no build
dependencies — open `index.html` and it runs.

This is a design POC, not the live site.

**Live:** https://grantxyzou.github.io/kerpconcept/

## Run it

```sh
python3 -m http.server 8000    # then open http://localhost:8000
```

## Hosting

GitHub Pages, driven by `.github/workflows/deploy.yml`. Every push to `main` runs the
responsive and accessibility gates first and only deploys if both pass, so a regression
fails the build instead of reaching the live URL. Pull requests run the same gates without
deploying.

The workflow publishes `index.html` plus `assets/` — not the whole repo, and not the
single-file `dist/` build, since separate CSS and JS cache better. Asset paths are relative,
which is what lets the site work from the `/kerpconcept/` sub-path a project Pages site uses.

A custom domain (say `poc.kerp.ca`) would need a `CNAME` file in the published output plus a
DNS record; nothing else about the setup would change.

## Build a single-file version

```sh
node build.js
```

Writes two files:

| File | What it's for |
| --- | --- |
| `dist/index.html` | Full document with CSS and JS inlined — drop on any static host |
| `dist/artifact.html` | Title, style and body only, for hosts that supply their own document shell |

## Check it

```sh
npm ci                     # playwright + axe-core, used by the checks
npx playwright install chromium
node build.js
node scripts/shots.js      # 390 / 768 / 1440 in both themes; fails on overflow or console errors
node scripts/a11y.js       # axe-core WCAG 2.1 AA, plus target size and focus visibility
node scripts/states.js     # viewport captures of specific states, written to .shots/
```

The scripts launch the Chromium that Playwright downloads. If you already have a browser
elsewhere — a preinstalled image, a shared cache — point `CHROMIUM_PATH` at it instead:

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/a11y.js
```

`shots.js` exits non-zero if the page scrolls horizontally at any viewport or if anything
logs to the console. `a11y.js` exits non-zero on any accessibility violation. Both work as
pre-commit gates.

### Accessibility

`scripts/a11y.js` runs axe-core against `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` in
six configurations — mobile, desktop and mobile-with-the-drawer-open, each in both themes.
It scrolls the whole page first so the scroll-reveal elements are in their final state,
since axe reads `opacity: 0` as hidden.

Two things axe cannot check are covered separately. Target size is measured against 44x44
CSS px — the WCAG 2.5.5 AAA bar, stricter than the 24x24 AA floor in 2.5.8. Focus
visibility is driven by real `Tab` presses rather than `element.focus()`, because
`:focus-visible` only matches keyboard-initiated focus and a programmatic call reports
every element as unstyled.

Current state: **0 violations in all six configurations**, all targets at or above 44px,
and a visible focus ring on every focusable element.

## The palette

Kerp's own brand: the deep brick red from the logo (`#A31C13`) on a near-white ground,
with black. Light is the default theme; dark is secondary, where the red lifts to
`#F04438` so it still clears contrast on `#141011`. The masthead and footer carry a CSS
rebuild of the logo lockup — a black serif K in a red disc.

The red is spent in three places only: things you can act on (buttons, links, prices, the
active tab), today's row in the hours table, and the full-bleed closing band. Section
labels and card prices stay neutral so the accent keeps its weight. Neutrals carry a faint
warm bias rather than being pure grey, so they sit with the red instead of fighting it.

The colour values were read off a screenshot of the live site rather than sampled from it,
so swap in exact codes if you have them. Two brand elements are deliberately not matched:
the live site sets body copy in mid-grey, which lands around 4.6:1 and would fail the
audit above, and it uses a geometric sans that would need self-hosting to reproduce
(no webfont is loaded here — see the type stack in `kerp.css`).

### Swapping it

`assets/css/kerp.css` opens with a `BRAND` block of eight values — the two grounds, the
red in its on-white and on-black forms, their hover states, and the text colour that sits
on a filled red surface. Every other rule reads through the tokens beneath it, and the
hero canvas reads `--accent` at runtime, so that one block re-skins both themes.

Two things live outside it and need a matching edit: the two `<meta name="theme-color">`
tags in `index.html` (the phone browser chrome, one per theme), and the neutral ramp —
`--surface`, `--line`, `--text-dim` and friends. If the accent hue moves, nudge that ramp's
bias the same way.

## What's in the design

**Mobile first.** Everything is built for a 320px column and widens from there — a full
screen nav drawer, a sticky Call / Book dock that rises once the hero CTAs scroll away, a
snap-scrolling work carousel that becomes a three-up grid on desktop, `44px` tap targets,
and safe-area padding so the dock clears the home indicator on notched phones.

**Live opening status.** The hero chip reads the current time in `America/Vancouver` and
resolves to "Open now · until 6pm", "Closed · opens today at 10am" or "Closed · opens
Monday at 10am". Today's row in the hours table is highlighted to match. If the browser
has no time zone data the chip removes itself and the static table stands on its own.

**The prices are the page.** The real price list is the thing people come for, so it gets
a proper tabbed table with tabular figures rather than a PDF link — arrow-key navigable,
`aria-selected` wired up.

**Two themes.** Light by default. Every colour is a token, redefined for dark in both the
`prefers-color-scheme` media query and an explicit `data-theme` stamp, so the page holds
up on a host that forces either one.

**A quiet hero.** A canvas draws slowly drifting diagonal bands — the barber pole, dialled
almost all the way down — at roughly 3% alpha, masked out before it reaches the text. The
occasional band picks up the brand red. It stops drawing when scrolled out of view and
never starts under `prefers-reduced-motion`.

## Content notes

Copy, prices, hours and contact details come from the business's public listings. Note that
the live site states **appointments only**, which overrides the "walk-ins welcome" field in
the directory listings — the page reflects the site. Only the
imagery is placeholder — the portrait, the work grid and the map embed — and each is
labelled as such in the page rather than faked. There are no invented testimonials —
the "what clients mention most" block summarises themes across the public reviews rather
than quoting people who never said it.

## Layout

```
index.html            markup
assets/css/kerp.css   tokens, components, breakpoints
assets/js/kerp.js     nav, live hours, tabs, reveals, hero canvas
build.js              inlines assets into dist/
.github/workflows/    gated deploy to GitHub Pages
scripts/shots.js      responsive + regression check
scripts/a11y.js       axe-core WCAG audit, target size, focus visibility
scripts/states.js     state captures for review
```
