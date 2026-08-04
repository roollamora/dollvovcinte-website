# Secret Cellar — Requirements (MVP)

Status: **implemented on `main`**; live at `/Secret-Cellar`. This doc is the acceptance gate for the feature.

## Goal

Login-only Notion-like private workspace for DVCT at `https://dollvovcinte.com/Secret-Cellar` supporting:

1. **Transcribing** — dump notes / transcript blocks
2. **Reporting** — structured sections with status + date
3. **Mood boards** — image URLs, color swatches, text cards

## Auth

| Requirement | Acceptance |
|-------------|------------|
| Content hidden until login | Pass — `#login-screen` gates `#app` |
| Username + password | Pass — form + `/api/auth` |
| Serverless credential check | Pass — `api/auth.js` uses `CELLAR_USER` / `CELLAR_PASS` |
| Session survives refresh in tab | Pass — `sessionStorage` + token verify |
| Logout | Pass |
| Changeable production secrets | Pass — Vercel env (defaults `admin` / `change-me`) |

**Required ops:** set real `CELLAR_USER`, `CELLAR_PASS`, `CELLAR_SECRET` in Vercel project env before real use.

## Document capabilities

| Capability | Acceptance |
|------------|------------|
| Document list + create | Pass — Page / Notes / Report / Mood |
| Mode switch per doc | Pass — page / transcript / report / mood |
| Blocks: H1–H3, paragraph, lists, divider, callout, transcript | Pass |
| Report meta (status, date) | Pass |
| Mood board: image URL, swatch, text card, reorder | Pass |
| Persist in browser | Pass — `localStorage` |
| Share via Export / Import JSON | Pass |
| Share via URL hash when small | Pass |

## Compatibility

| Constraint | Acceptance |
|------------|------------|
| Do not break `index.html` coming-soon | Pass — untouched |
| Do not break `glitch-test.html` | Pass — untouched |
| Path `/Secret-Cellar` works with `cleanUrls` | Pass — HTTP 200 |
| `api/auth` works on Vercel | Pass — login returns `{ ok, token }` |
| Deploy workflow verifies Secret-Cellar files | Pass — steps exist |
| Not excluded by `.vercelignore` | Pass — folder/app shipped |

## Non-goals (MVP)

- Live multi-user realtime sync
- Per-user accounts / invite system
- File uploads to cloud storage (image URLs only)
- Public indexing (`noindex` set)

## Fitness checklist

- [x] `/Secret-Cellar` loads
- [x] Login gates content
- [x] `/api/auth` accepts demo credentials until env changed
- [x] Transcription / report / mood modes present
- [x] Export / import / share link present
- [x] Homepage + glitch lab intact
- [ ] Production passwords changed from defaults *(ops — user)*
- [ ] GitHub Actions `VERCEL_TOKEN` valid again *(ops — user; Vercel Git deploy still works)*

## Remaining modifications (ranked)

1. **P0 — Ops:** Rotate `CELLAR_PASS` / set `CELLAR_SECRET` in Vercel
2. **P0 — Ops:** Refresh GitHub secret `VERCEL_TOKEN` so Actions auto-deploy works again
3. **P1 — Product:** Optional shared backend sync (later)
4. **P2 — UX:** Richer mood-board image upload without URLs
