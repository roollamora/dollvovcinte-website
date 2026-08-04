# Requirements Document

## Introduction

This document specifies the requirements for **Secret Cellar**, a private, login-gated,
Notion-like collaborative workspace served at `https://dollvovcinte.com/Secret-Cellar`.
It supports free-form document writing, transcription capture, structured reporting, and
visual mood boards. It is delivered as static assets plus one Vercel serverless function,
inside the existing `dollvovcinte.com` repository, and must not disturb the existing
public pages.

## Glossary

- **Cellar_App**: The Secret Cellar single-page application in `Secret-Cellar/`
- **Auth_Function**: The Vercel serverless route `api/auth.js` mounted at `/api/auth`
- **Session**: A signed, expiring token held in `sessionStorage` after successful login
- **Workspace**: The complete set of user documents, persisted as one `localStorage` record
- **Document**: A single titled record with a mode, ordered blocks, and mood items
- **Mode**: One of `page`, `transcript`, `report`, `mood` — selects the editing affordances
- **Block**: An ordered content unit within a Document (heading, text, list, divider,
  callout, transcript)
- **Mood_Item**: An image, colour swatch, or text card on a mood board
- **Existing_Site**: The pre-existing public artefacts — `index.html`, `glitch-test.html`,
  `Public/`, `scroll-player/`, and the root validation scripts
- **Deploy_Pipeline**: `.github/workflows/deploy.yml` driving `vercel build` / `vercel deploy`

## Requirements

### Requirement 1 — Login-only access

**User Story:** As the workspace owner, I want no content visible before authentication,
so that private notes are not casually readable.

#### Acceptance Criteria

1. WHEN `/Secret-Cellar` loads, THE Cellar_App SHALL render only the login screen and
   SHALL keep all Workspace content hidden until a Session is verified.
2. THE Cellar_App SHALL fail closed — any error, timeout, or indeterminate state during
   session verification SHALL result in the login screen, never the Workspace.
3. THE Auth_Function SHALL validate credentials against the `CELLAR_USER` and
   `CELLAR_PASS` environment variables using constant-time comparison.
4. THE Auth_Function SHALL issue an HMAC-signed token, scoped by `CELLAR_SECRET`, that
   carries an expiry and SHALL reject expired or tampered tokens.
5. WHEN the Auth_Function runs in a deployed Vercel environment AND `CELLAR_USER` or
   `CELLAR_PASS` is unset, THE Auth_Function SHALL refuse all logins and return a
   "not configured" error rather than accepting built-in default credentials.
6. THE Cellar_App SHALL accept built-in demo credentials ONLY when served from
   `localhost`, `127.0.0.1`, or `file://`, and SHALL NOT expose a demo bypass on the
   production origin.
7. THE Cellar_App SHALL NOT display usable credentials in page copy on a production origin.
8. WHEN the user logs out, THE Cellar_App SHALL clear the Session and return to the
   login screen.
9. THE Cellar_App SHALL declare `noindex, nofollow` so the page is excluded from search
   engines.

> **Accepted limitation (MVP):** gating is client-side. `Secret-Cellar/*` static assets
> are publicly fetchable, so the *shell* (markup, CSS, JS) is not secret. No user content
> is exposed by this, because every Workspace lives only in the visitor's own browser
> storage and is never uploaded. Server-enforced gating is a post-MVP item (Requirement 9).

### Requirement 2 — Document workspace

**User Story:** As a user, I want to create and organise multiple documents, so that I can
keep separate notes, reports, and boards in one place.

#### Acceptance Criteria

1. THE Cellar_App SHALL let the user create a Document in any Mode.
2. THE Cellar_App SHALL list all Documents with a Mode indicator and title, ordered by
   most recently updated.
3. THE Cellar_App SHALL let the user select, rename, and delete any Document, with
   confirmation before deletion.
4. THE Cellar_App SHALL let the user change a Document's Mode after creation.
5. WHEN no Documents exist, THE Cellar_App SHALL show an empty state offering creation.

### Requirement 3 — Block editor

**User Story:** As a user, I want Notion-like block editing, so that writing feels
structured and fast.

#### Acceptance Criteria

1. THE Cellar_App SHALL support these Block types: paragraph, heading 1, heading 2,
   heading 3, bulleted item, numbered item, divider, callout, transcript.
2. THE Cellar_App SHALL let the user append a Block of any type.
3. THE Cellar_App SHALL let the user reorder Blocks by drag-and-drop and by move up /
   move down controls.
4. THE Cellar_App SHALL let the user change an existing Block's type and delete a Block.
5. WHEN the user presses Enter in a list Block, THE Cellar_App SHALL create a sibling
   list Block and move focus into it.
6. WHEN the user presses Backspace in an empty Block, THE Cellar_App SHALL delete that
   Block and restore focus to the preceding Block.
7. THE Cellar_App SHALL auto-size text inputs to their content so no Block scrolls
   internally.

### Requirement 4 — Transcription

**User Story:** As a user, I want to capture spoken material as timestamped text, so that
I can transcribe sessions without leaving the workspace.

#### Acceptance Criteria

1. THE Cellar_App SHALL provide a transcript Block carrying an editable timestamp
   alongside its text.
2. THE Cellar_App SHALL default a new transcript Block's timestamp to the current
   local date and time.
3. THE Cellar_App SHALL support pasting or typing bulk transcript text into a transcript
   Block.
4. WHERE the browser exposes the Web Speech API, THE Cellar_App SHALL offer dictation
   that appends recognised speech into the active transcript Block, with a visible
   recording state and an explicit stop control.
5. WHERE the Web Speech API is unavailable, THE Cellar_App SHALL hide or disable the
   dictation control and SHALL remain fully usable for manual transcription.
6. THE Cellar_App SHALL persist transcript text continuously as it is produced, so an
   interrupted session does not lose captured speech.

### Requirement 5 — Reporting

**User Story:** As a user, I want report documents with status and date metadata, so that
I can track structured write-ups.

#### Acceptance Criteria

1. THE Cellar_App SHALL provide a report Mode that pre-populates a title, summary,
   sections, and a takeaway callout.
2. THE Cellar_App SHALL let a report carry a status of draft, in progress, review, or final.
3. THE Cellar_App SHALL let a report carry a date.
4. THE Cellar_App SHALL persist status and date changes immediately.
5. THE Cellar_App SHALL expose report metadata controls only for Modes where they apply.

### Requirement 6 — Mood board

**User Story:** As a user, I want a visual board of images, colours, and notes, so that I
can collect references and atmosphere.

#### Acceptance Criteria

1. THE Cellar_App SHALL let the user add an image Mood_Item from a URL.
2. THE Cellar_App SHALL let the user add a colour swatch Mood_Item with its value shown.
3. THE Cellar_App SHALL let the user add an editable text card Mood_Item.
4. THE Cellar_App SHALL let the user reorder Mood_Items by drag-and-drop and remove any
   Mood_Item.
5. WHEN an image fails to load, THE Cellar_App SHALL show a non-breaking placeholder in
   its place.
6. THE Cellar_App SHALL request images without a referrer.
7. THE Cellar_App SHALL treat Mood_Item values from imported or shared data as untrusted
   and SHALL NOT allow them to inject markup, script, or arbitrary CSS.

### Requirement 7 — Persistence and sharing

**User Story:** As a user, I want my work to survive reloads and to be movable between
browsers, so that nothing is lost and collaboration is possible.

#### Acceptance Criteria

1. THE Cellar_App SHALL persist the entire Workspace to `localStorage` under a single
   versioned key, on every mutation.
2. WHEN stored data is missing, malformed, or of an unknown shape, THE Cellar_App SHALL
   fall back to a valid default Workspace rather than failing to start.
3. THE Cellar_App SHALL export the Workspace as a downloadable JSON file.
4. THE Cellar_App SHALL import a Workspace JSON file, validate its shape, and confirm
   with the user before replacing local data.
5. THE Cellar_App SHALL produce a share link that carries a compressed Workspace in the
   URL fragment, and SHALL report a clear error directing the user to export when the
   payload exceeds a safe URL length.
6. WHEN a share link is opened, THE Cellar_App SHALL require login first, then confirm
   before replacing local data, then clear the fragment from the address bar.
7. THE Cellar_App SHALL state plainly in the UI that storage is per-browser and that
   live multi-user sync is not available.

### Requirement 8 — Routing, deployment, and site compatibility

**User Story:** As the site owner, I want Secret Cellar to deploy cleanly without
regressing the existing site.

#### Acceptance Criteria

1. THE Cellar_App SHALL be reachable at `/Secret-Cellar` on the production domain.
2. THE Cellar_App SHALL reference its own stylesheet and scripts by root-absolute path,
   so that assets resolve correctly under `cleanUrls: true` and `trailingSlash: false`,
   where the document URL carries no trailing slash.
3. THE Cellar_App SHALL NOT modify, restyle, or inject globals into `index.html`,
   `glitch-test.html`, or any Existing_Site asset.
4. THE Cellar_App SHALL scope every browser-storage key it uses under a `secret-cellar-`
   prefix to avoid collision with Existing_Site storage.
5. THE Cellar_App SHALL load all styles and scripts from its own directory, sharing no
   CSS file, global stylesheet, or global JavaScript namespace with Existing_Site.
6. THE `.vercelignore` file SHALL NOT exclude `Secret-Cellar/` or `api/` from deployment.
7. THE Deploy_Pipeline SHALL verify the presence of the Cellar_App entry point and the
   Auth_Function, failing the build if either is missing.
8. THE Cellar_App SHALL NOT introduce a `package.json`, build step, or runtime dependency,
   preserving the repository's zero-build static deployment model.
9. THE Auth_Function SHALL use only the Node.js standard library.
10. Repository documentation (`*.md`) SHALL remain excluded from the deployed output.

### Requirement 9 — Non-goals for MVP

The following are explicitly out of scope for this release and SHALL NOT block acceptance:

1. Live multi-user real-time sync or presence, and any server-side document storage.
2. Multiple user accounts, roles, or per-document permissions — a single shared
   credential pair is sufficient.
3. Server-enforced gating of static assets (edge middleware or password-protected
   deployments).
4. Server-side audio-file transcription, speaker diarisation, or any paid speech API.
5. Rich inline text formatting (bold, italic, links), nested blocks, tables, and
   embedded databases.
6. Image uploads or hosting — mood board images are referenced by external URL only.
7. Full-text search, tags, comments, version history, and offline service-worker caching.
8. Brute-force rate limiting and account lockout on the Auth_Function.

## Acceptance Criteria Checklist

Verification gate for release. Each item must be confirmed before the feature is
considered done.

- [ ] `https://dollvovcinte.com/Secret-Cellar` returns 200 and renders fully styled
- [ ] Stylesheet and module scripts load with no 404 on the production URL
- [ ] Login screen appears first; no Workspace content is reachable before login
- [ ] Correct credentials from `CELLAR_USER` / `CELLAR_PASS` grant access
- [ ] Wrong credentials are rejected with a visible error
- [ ] With `CELLAR_*` unset in production, login is refused rather than defaulted
- [ ] No usable credentials appear in production page copy
- [ ] Logout returns to the login screen and clears the Session
- [ ] Page carries `noindex, nofollow`
- [ ] Create, select, rename, and delete work for Documents in all four Modes
- [ ] All nine Block types render, reorder, retype, and delete correctly
- [ ] Enter in a list creates a sibling; Backspace in an empty Block removes it
- [ ] Transcript Blocks carry editable timestamps and accept bulk paste
- [ ] Dictation appends recognised speech where supported, and degrades silently elsewhere
- [ ] Report Mode offers status and date, and persists both
- [ ] Mood board adds, reorders, and removes images, swatches, and text cards
- [ ] A broken image URL shows a placeholder without breaking the board
- [ ] Reload restores the Workspace from `localStorage`
- [ ] Export downloads valid JSON; Import validates, confirms, and replaces
- [ ] Share link round-trips a small Workspace and errors clearly when oversized
- [ ] Mobile layout is usable and the sidebar can be opened and closed
- [ ] `https://dollvovcinte.com/` still renders the coming-soon hero unchanged
- [ ] `https://dollvovcinte.com/glitch-test` still renders the Mix Lab unchanged
- [ ] Deploy workflow passes and verifies Secret Cellar files
