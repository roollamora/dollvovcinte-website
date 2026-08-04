# Secret Cellar

Private Notion-like workspace for DVCT at `/Secret-Cellar`.

## URLs

- Production: https://dollvovcinte.com/Secret-Cellar
- Also: https://dollvovcinte.com/Secret-Cellar/ (cleanUrls may normalize trailing slash)

## Auth

Login is required before any content is shown.

- **Production (recommended):** Vercel serverless route `POST/GET /api/auth`
  - Env vars in the Vercel project:
    - `CELLAR_USER` — username (default `admin`)
    - `CELLAR_PASS` — password (default `change-me`)
    - `CELLAR_SECRET` — optional HMAC secret for session tokens (defaults to `CELLAR_PASS`)
  - Successful login returns a signed token stored in `sessionStorage` (tab session).
- **Local / API unavailable:** falls back to demo credentials `admin` / `change-me` only when `/api/auth` cannot be reached.

**Warning:** Change the default password before real use. Do not commit production secrets.

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
