# ShopView homepage — Night Shift

Static site: plain HTML/CSS/JS, no build step. Open `index.html` through any static server, e.g.

```bash
python3 -m http.server 8766
```

- `flight.js` — the scroll-scrubbed Night Shift flight (8 clips in `assets/video/`)
- `smooth.js` — Lenis smooth scrolling (vendored in `vendor/lenis-1.1.13/`)
- `rain.js` — rain overlay over the hero
- `site.js` — nav, roles, testimonials, video facade, quote reveal, CTA dots
- Config: `window.SHOPVIEW_FLIGHT` in `index.html` (snap, smooth, rain)

Bump the `?v=` query on the CSS/JS links in `index.html` whenever those files change.
