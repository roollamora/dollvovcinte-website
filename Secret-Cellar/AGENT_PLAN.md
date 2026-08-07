# Secret Cellar — Agent & model assignment

How work was / should be split for this feature. Models chosen for fit to task.

| Part | Model | Why | Status |
|------|-------|-----|--------|
| Initial app build (UI + auth + storage) | Default / inherit (implementation agent) | End-to-end product build in one coherent pass | Done — `Secret-Cellar/`, `api/auth.js` |
| Requirements + acceptance gate | Claude Opus (thinking high) | Architecture, security checklist, fitness against constraints | Done — this folder’s `REQUIREMENTS.md` |
| Feature coordinator / compatibility audit | Claude Opus (thinking high) | Cross-check deploy, vercel, existing pages | Done in this continue pass |
| Fast wiring / deploy workflow tweaks | Composer 2.5 Fast | Mechanical edits to Actions / vercel.json | In progress this pass |
| Deep UI polish / editor upgrades | Claude Sonnet (thinking high) | Best for interactive editor / mood board depth | Use if expanding MVP |
| Fast exploration / digs | Grok 4.5 High Fast | Quick repo scans | Optional |

## Active process map

1. **Implementation** — shipped on `main` (`3ec4ca5`)
2. **Coordinator / requirements** — continued here after session move to cloud workspace
3. **Deploy** — Vercel Git integration already published `/Secret-Cellar`; GitHub Actions deploy is **broken** until `VERCEL_TOKEN` is refreshed (Actions cannot set secrets from this agent — 403)

## Rule for future Secret-Cellar work

- Spec / auth / security review → Opus
- Editor / mood board features → Sonnet
- One-line deploy/config fixes → Composer Fast
- Do not spin duplicate full rebuilds; extend existing files
