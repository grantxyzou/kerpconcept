# kerp.ca — redesign proof of concept

A mobile-first redesign of [kerp.ca](https://kerp.ca), the site for **Kerp Barbershop &
Salon** at 524 W Pender St in downtown Vancouver. Single page, no framework, no build
dependencies — open `index.html` and it runs.

This is a design POC, not the live site.

## Run it

```sh
python3 -m http.server 8000    # then open http://localhost:8000
```

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
npm install                # playwright only, used for the checks
node build.js
node scripts/shots.js      # 390 / 768 / 1440 in both themes; fails on overflow or console errors
node scripts/states.js     # viewport captures of specific states, written to .shots/
```

`shots.js` exits non-zero if the page scrolls horizontally at any viewport or if anything
logs to the console, so it works as a pre-commit gate.

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

**Two themes.** Dark by default, since the identity is a mirror-lit room. Every colour is
a token, redefined for light in both the `prefers-color-scheme` media query and an
explicit `data-theme` stamp, so the page holds up on a host that forces either one.

**A quiet hero.** A canvas draws slowly drifting diagonal bands — the barber pole turned
almost all the way down — at roughly 3% alpha, masked out before it reaches the text. It
stops drawing when scrolled out of view and never starts under `prefers-reduced-motion`.

## Content notes

Copy, prices, hours and contact details come from the business's public listings. Only the
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
scripts/shots.js      responsive + regression check
scripts/states.js     state captures for review
```
