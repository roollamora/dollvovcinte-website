# Compatibility Audit — Secret Cellar vs. existing dollvovcinte.com

Audit of the Secret Cellar feature against the pre-existing site. Requirements in
`requirements.md`; model plan in `model-assignment.md`.

## Scope inspected

`index.html`, `glitch-test.html`, `vercel.json`, `.vercelignore`,
`.github/workflows/deploy.yml`, `.vercel/project.json`, `.gitignore`, `Public/`,
`scroll-player/`, root `*.js` validation scripts, `Secret-Cellar/**`, `api/auth.js`.

## Defects found and fixed

### 1. Asset paths broke the page in production (blocking)

`vercel.json` sets `cleanUrls: true` and `trailingSlash: false`, so Vercel serves the app
at `/Secret-Cellar` — no trailing slash — and redirects `/Secret-Cellar/` to it. Relative
URLs in the document therefore resolve against the *parent* directory:

- `href="styles.css"` → `dollvovcinte.com/styles.css` → 404
- `src="js/app.js"` → `dollvovcinte.com/js/app.js` → 404

The result would have been an unstyled page with no JavaScript at all. Fixed by switching
both references to root-absolute paths. The `./auth.js` / `./storage.js` imports inside
`js/app.js` were already correct, because module specifiers resolve against the importing
module's URL rather than the document URL.

Consequence documented in the README: absolute paths mean the app must be served from the
repository root during local development, not opened from disk.

### 2. Working credentials were printed on the public login page (blocking)

The login card rendered `Demo default: admin / change-me` in static markup, and
`api/auth.js` fell back to exactly those values via `process.env.CELLAR_USER || 'admin'`.
Anyone visiting the URL could read the credentials and use them. Three fixes:

- Credentials removed from the markup and from the HTML comment.
- `api/auth.js` now fails closed: when `process.env.VERCEL` is set and `CELLAR_USER` or
  `CELLAR_PASS` is missing, every request returns 503 rather than accepting defaults.
  Defaults survive for non-Vercel local runs only.
- The client-side demo fallback in `js/auth.js` is gated behind `isLocalOrigin()`, so a
  transient network failure on the production domain can no longer grant access.

### 3. Local development login was unreachable (moderate)

The demo fallback originally triggered only on a thrown `TypeError`. A static file server
answers `POST /api/auth` with a real `501` — a successful HTTP exchange, not a network
error — so the fallback never engaged and local login always failed. Fixed by also
treating 404/405/501/502 as "no serverless runtime present", still gated on a local
origin. Verified: `python3 -m http.server` returns 501 for that request.

### 4. CI did not protect the feature (moderate)

The workflow's "Verify site files" step checked only the four original site files. A
renamed or missing Secret Cellar file would have deployed a broken page silently.
Assertions added for all five app files and `api/auth.js`.

### 5. Untrusted imported values reached the DOM (moderate)

Workspaces arrive from untrusted sources via Import JSON and `#share=` links. A mood swatch
value flowed unvalidated into `style.background`, allowing CSS injection such as an external
`url(...)` reference that would leak a request; image values reached `img.src` with no
scheme check. Both are now validated against strict allowlists, with a safe fallback and
the existing placeholder respectively.

## Verified clean — no action needed

- **Existing pages untouched.** No diff against `index.html`, `glitch-test.html`,
  `vercel.json`, `.vercelignore`, `Public/`, `scroll-player/`, or any root script.
- **No style or script collision.** Secret Cellar loads only its own `styles.css` and its
  own ES modules. Because they are modules, nothing is added to the global namespace, so
  there is no way to collide with `glitch-test.html`, which is entirely self-contained with
  inline styles and scripts.
- **No storage-key collision.** `glitch-test.html` and `index.html` use no browser storage
  at all. Every Secret Cellar key is prefixed `secret-cellar-`
  (`secret-cellar-docs-v1`, `secret-cellar-session`).
- **Deployment not excluded.** `.vercelignore` excludes `.kiro`, `.github`, `*.md`,
  `test-*`, `final-*`, `integration-*`, `checkpoint-*`, `task-*`, `scroll-player`, and the
  validation scripts. It matches neither `Secret-Cellar/` nor `api/`, so both deploy. The
  `*.md` rule usefully keeps this spec and the README out of the deployed output.
- **Zero-build model preserved.** No `package.json`, no dependency, no build step.
  `api/auth.js` uses only `node:crypto`, and CommonJS is correct for a repository with no
  `package.json`. Vercel picks up `api/` as a serverless function with no configuration.
- **Route casing matches.** The requested URL `/Secret-Cellar` matches the directory name
  exactly, which matters because Vercel's filesystem is case-sensitive even though macOS
  is not.
- **Search engines excluded.** The page declares `noindex, nofollow`.

## Accepted limitations

- **The login gate is client-side.** `Secret-Cellar/*` assets are publicly fetchable, so
  the page shell is not secret. This exposes no user content, because every workspace lives
  only in the visitor's own `localStorage` and is never uploaded. Server-enforced gating is
  a post-MVP item.
- **`verifySession()` keeps an existing session when `/api/auth` is unreachable**, rather
  than failing closed, so the app stays usable offline. This adds no real attack surface:
  anyone able to forge the `sessionStorage` record could equally bypass a client-side gate
  outright.
- **No brute-force rate limiting** on the auth function. Listed as an MVP non-goal; a
  single strong passphrase in `CELLAR_PASS` is the mitigation.

## Required manual step before the feature is usable

Set `CELLAR_USER`, `CELLAR_PASS`, and ideally `CELLAR_SECRET` (an independent random value)
in the Vercel project `dollvovcinte-website`, for the Production environment, then redeploy.
Until that is done the deployed login correctly refuses every attempt with
`503 Auth not configured`.
