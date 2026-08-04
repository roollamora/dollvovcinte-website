# Secret Cellar

Private Notion-like workspace for DVCT at `/Secret-Cellar`.

## URLs

- Production: https://dollvovcinte.com/Secret-Cellar
- Also: https://dollvovcinte.com/Secret-Cellar/ (cleanUrls may normalize trailing slash)

## Auth

Login is required before any content is shown.

- **Production:** Vercel serverless route `POST/GET /api/auth`
  - Required env vars in the Vercel project:
    - `CELLAR_USER` — username
    - `CELLAR_PASS` — password
    - `CELLAR_SECRET` — optional HMAC secret for session tokens (defaults to `CELLAR_PASS`)
  - Successful login returns a signed, expiring token stored in `sessionStorage` (tab session).
  - **A deployed instance with `CELLAR_USER` or `CELLAR_PASS` unset refuses every login
    with HTTP 503.** There is no default credential in production — set the env vars before use.
- **Local development:** when `/api/auth` is unreachable *and* the page is served from
  `localhost` / `127.0.0.1` / `file:`, the app accepts demo credentials `admin` / `change-me`.
  This fallback cannot trigger on the production origin.

**Known limitation:** the gate is client-side. `Secret-Cellar/*` assets are publicly
fetchable, so the page shell is not secret. No user content is exposed by this, because
every workspace lives only in the visitor's own `localStorage` and is never uploaded.
Server-enforced gating is post-MVP.

## Local development

Asset paths are root-absolute (`/Secret-Cellar/...`) so that they resolve on Vercel, where
`trailingSlash: false` means the page is served at `/Secret-Cellar` with no trailing slash.
Because of that, opening `index.html` directly from disk will not load styles or scripts.
Serve the repository root instead:

```
python3 -m http.server 8000
# then open http://localhost:8000/Secret-Cellar/
```

## Sharing

There is **no live multi-user sync** yet. Documents persist in each browser’s `localStorage`.

To share:

1. **Export JSON** — download workspace file
2. **Import JSON** — load a file (replaces local workspace)
3. **Copy share link** — compresses workspace into the URL hash when small enough; otherwise use Export

## Features

- Document list + create Page / Transcription / Report / Mood board
- Block editor: H1–H3, paragraph, bullet & numbered lists, divider, callout, transcript blocks (optional timestamp)
- Report meta: status + date
- Mood board: image URLs, color swatches, text cards, drag reorder
- Modes toggleable per document

## Deploy notes

- App lives in `Secret-Cellar/` (not excluded by `.vercelignore`)
- Auth function: `api/auth.js`
- Does not modify root `index.html` or `glitch-test.html`
