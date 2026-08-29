# Frontend Handoff

Updated: 2026-08-28

## Current status

- `/` redirects to `/event-chat`; `/settings` shares the responsive application
  shell. Light, Dark, and System themes are available.
- Event Chat calls NestJS directly, reloads the authoritative persisted timeline
  after successful operations, and renders text plus Event Card/Edit/Confirm/
  Reject interactions.
- Pending Drafts support validated Edit, Confirm, and Reject actions. Event Cards
  are compact on desktop and full-width on mobile.
- Zustand owns cross-route Event Chat workflow state. Unknown delivery restores
  submitted text and blocks further mutation until authoritative reload.
- The keyboard-only composer sends with Enter and inserts a line break with
  Shift+Enter. Empty chat suggestions fill the composer but never auto-submit.
- User-facing copy is brand-neutral; internal workspace package names are
  unchanged.

## Active boundary

The frontend still uses the Phase 3 Draft Confirm/Reject endpoints. When Agent
Phase 4 Slice 2 ships, replace them with `approve`, `deny`, and `reject_event`;
do not retain two public final-transition paths. Edit may remain deterministic.

## Next slice

Add one browser-local IANA timezone preference using React Hook Form, Zod, and a
versioned localStorage key. Default to the detected system timezone, support
restoring it, and capture the selected timezone per future message submission.
Do not add a Settings API, user profile, authentication, or database field.

## Verification gaps and risks

- Frontend typecheck, lint, build, and running-browser inspection have not run.
- Verify desktop and 375px navigation plus complete, incomplete, edited,
  confirmed, rejected, refresh, theme, and controlled-error flows.
- Unknown POST safety still lacks backend idempotency or operation status;
  timeline pagination remains deferred until conversation size requires it.

See `apps/web/AGENTS.md` for frontend architecture and collaboration rules.
