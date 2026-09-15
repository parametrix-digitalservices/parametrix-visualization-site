# Parametrix Visualization Services

Static marketing site for the Parametrix Visualization Services practice.
Built to be served by GitHub Pages with no build step — every file here is
deployed exactly as it sits.

## Pages

| Path | Page |
|---|---|
| `/` | Visualization Services overview — links to all three offerings |
| `/photo-simulations/` | Camera-matched photo simulations, with before/after sliders |
| `/visualization-twin/` | Visualization Twin development, demo video and traffic-model explainer |

SnapStreets is described on the overview page; it does not have its own page yet.

## Layout

```
index.html                     overview / landing
photo-simulations/index.html
visualization-twin/index.html
assets/css/site.css            one stylesheet for all three pages
assets/img/                    photography, renderings, screenshots, logo, favicon
assets/video/                  twin-demo.mp4 (18 MB), traffic-sim.mp4 (3.5 MB)
.nojekyll                      serve files as-is, no Jekyll processing
```

All internal links are relative, so the site works whether it is published at
the domain root (`<org>.github.io`) or under a project path
(`<org>.github.io/<repo>/`).

## Publishing to GitHub Pages

1. Push this repository to `github.com/parametrix-digitalservices/<repo-name>`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*,
   then choose branch `main` and folder `/ (root)`.
4. Save. The first build takes a minute or two; the URL appears at the top of
   that same settings page.

If the repository is private, GitHub Pages requires a paid plan. A public
repository publishes on any plan.

## Editing

- Copy, headings and links live directly in the three `index.html` files.
- All colours, type and layout live in `assets/css/site.css`. Brand tokens are
  the custom properties at the top (`--red` is Parametrix `#EE3D24`,
  `--ink` charcoal `#333333`, `--yellow` the transportation sector accent).
- Both pages carry a light and a dark theme; the dark values are set in the
  `prefers-color-scheme` block of the same stylesheet.
- Replacing a photo means dropping a new file into `assets/img/` under the same
  name — no other change needed.

## Media notes

- Videos are H.264 MP4 with `preload="metadata"`, so a visitor only downloads
  the full file if they press play. The traffic simulation clip autoplays muted
  on loop, and holds still for anyone whose system asks for reduced motion.
- Source video and photography are larger than what is committed here; these are
  web encodes. Keep the originals outside the repository.
