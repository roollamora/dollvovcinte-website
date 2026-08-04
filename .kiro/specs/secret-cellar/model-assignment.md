# Model Assignment Plan — Secret Cellar

Coordination record for which model owned which part of the feature, and why.
Requirements live in `requirements.md`; audit results in `compatibility-audit.md`.

## Assignment

| Part | Model | Why |
|------|-------|-----|
| Requirements spec, acceptance criteria, non-goals | `claude-opus-5-thinking-high` (coordinator) | Needs whole-system judgement and the authority to declare scope. Getting the acceptance gate wrong invalidates every downstream task, so this is the highest-leverage reasoning step. |
| Compatibility audit (routing, deploy, ignores, storage keys) | `claude-opus-5-thinking-high` (coordinator) | The `cleanUrls` / `trailingSlash` interaction is a subtle, config-level failure that only shows up in production. Requires reading intent across `vercel.json`, `.vercelignore`, and the workflow together rather than file by file. |
| Auth design and security review (`api/auth.js`, `js/auth.js`, login markup) | `claude-opus-5-thinking-high` (coordinator) | Fail-closed behaviour, credential exposure, and token verification are the parts where a plausible-looking implementation is still wrong. Deserved the strongest reasoning model and direct ownership rather than delegation. |
| Initial full build — workspace, block editor, report mode, mood board, persistence, export/import, share links | prior implementation agent | Already held complete context for a 2,100-line app it had just written. Rebuilding from scratch would have been pure waste; the right move was to audit its output and patch the gaps. |
| Transcription dictation (Web Speech API) + untrusted-input hardening | `claude-sonnet-5-thinking-high` | A self-contained, stateful browser feature inside two files. Needs careful lifecycle logic (interim vs final results, spontaneous `onend` restarts, teardown on re-render) but no cross-system judgement — the sweet spot for solid feature implementation. |
| Path fixes, CI verification step, README | `claude-opus-5-thinking-high` (coordinator) | Deliberately *not* delegated to `composer-2.5-fast`. Each was a one-to-four-line edit, and the coordinator already had every file in context, so a handoff would have cost more than the edit. Kept here to avoid concurrent writes to files the Sonnet agent was editing. |
| Final fitness check and commit | `claude-opus-5-thinking-high` (coordinator) | Quality gate must be a single accountable owner reading the real diff, not a summary of it. |

## Deviations from the original plan

Two conscious changes, both to reduce risk:

1. **`composer-2.5-fast` was not used.** It was earmarked for mechanical wiring, but by the
   time the gaps were known, the mechanical work totalled about ten lines across four files.
   Delegating would have added a context handoff and a file-conflict risk larger than the
   task itself.
2. **The build agent was not resumed.** It could not be reached from this coordinator
   session, and it had already committed its work, so its output was audited as a finished
   artefact and patched forward instead.

## File-ownership partitioning

Because two agents worked concurrently, write access was partitioned so no file had two
writers:

- Sonnet agent: `Secret-Cellar/js/app.js`, `Secret-Cellar/styles.css`
- Coordinator: `Secret-Cellar/index.html`, `Secret-Cellar/js/auth.js`, `api/auth.js`,
  `.github/workflows/deploy.yml`, `Secret-Cellar/README.md`, `.kiro/specs/secret-cellar/*`

This is worth repeating on any future multi-agent change here: the one collision that did
occur (duplicated `test -f` lines in `deploy.yml`) happened precisely because two agents
edited one file without a declared owner.
