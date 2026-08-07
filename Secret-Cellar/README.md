# Secret Cellar

Private Notion-like workspace for DVCT at `/Secret-Cellar`.

## URLs

- Production: https://dollvovcinte.com/Secret-Cellar
- Also: https://dollvovcinte.com/Secret-Cellar/ (cleanUrls may normalize trailing slash)

## Auth

Login is required before any content is shown.

- **Production:** Vercel serverless route `POST/GET /api/auth`
  - Built-in accounts:
    - `Boss-Girl` / `12345678`
    - `R` / `heya!`
  - Optional env overrides:
    - `CELLAR_USERS` — JSON map merged on top of defaults
    - `CELLAR_USER` / `CELLAR_PASS` — extra single account
    - `CELLAR_SECRET` — HMAC secret for session tokens
  - Successful login returns a signed, expiring token in `sessionStorage`.
- **Local development:** same accounts when `/api/auth` is unreachable on localhost / file:.

**Known limitation:** the gate is client-side. `Secret-Cellar/*` assets are publicly
fetchable; workspace data stays in each visitor's `localStorage`.

## Local development

Asset paths are root-absolute (`/Secret-Cellar/...`). Serve the repo root:

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
- Health automation: `scripts/check-secret-cellar.sh` + `.github/workflows/secret-cellar-health.yml`
- If GitHub Action **Deploy dollvovcinte.com** fails with invalid token: refresh repo secret `VERCEL_TOKEN` in GitHub → Settings → Secrets. Vercel’s Git integration may still deploy on push.
- Requirements / model plan: `REQUIREMENTS.md`, `AGENT_PLAN.md` (excluded from Vercel by `*.md` ignore)
