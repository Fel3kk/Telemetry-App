# GitHub Pages build

This folder is the static, GitHub Pages–friendly version of the F1 Telemetry
Analyzer. It contains only the files the browser needs:

- `index.html` (and `404.html`, a copy so deep links don't 404)
- `script.js`, `chart-theme.js`, `styles.css`
- `.nojekyll` so GitHub Pages serves files starting with `_` untouched

The app is fully client-side (Chart.js + supabase-js loaded from CDNs), so no
build step is required.

## Deploy — two options

### 1. GitHub Actions (recommended, already wired up)

`.github/workflows/gh-pages.yml` uploads this `docs/` folder to Pages on every
push to `main`. To enable:

1. Push the repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site URL appears under
   Settings → Pages once the run finishes.

### 2. Serve `/docs` from `main` (no workflow)

1. Repo **Settings → Pages → Source = Deploy from a branch**.
2. Branch = `main`, Folder = `/docs`, Save.

## Updating the site

The Lovable preview reads from `public/app/`. After changes there, copy them
over before pushing:

```bash
cp public/app/index.html      docs/index.html
cp public/app/index.html      docs/404.html
cp public/app/script.js       docs/script.js
cp public/app/chart-theme.js  docs/chart-theme.js
cp public/app/styles.css      docs/styles.css
```

All asset paths in `index.html` are relative, so the site works at both
`https://<user>.github.io/<repo>/` and a custom domain without changes.