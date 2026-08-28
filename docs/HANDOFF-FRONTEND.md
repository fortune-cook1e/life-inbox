# Frontend Handoff

Updated: 2026-08-28

## Direction and scope

- The frontend is a quiet, warm, single-column assistant timeline.
- V1 renders Event interactions only. Email UI is out of scope.
- NestJS and PostgreSQL own business state; React owns display and temporary
  interaction state.

## Implemented

- `LifeInboxApp` is a composition root only. `useLifeInbox` owns API and
  interaction state; Header, Timeline, Notice, Composer, timeline-message
  rendering, and Event Draft Card UI have separate component boundaries.
- shadcn/ui is the frontend design-system boundary. Feature components consume
  its Button, Input, Textarea, Label, Card, Badge, and Alert primitives instead
  of recreating controls with feature-local class constants.
- Message composition and Event Draft editing use React Hook Form with Zod.
  Client validation provides field-level feedback; NestJS remains authoritative
  for Event Draft state transitions and persisted values.
- The Next.js client consumes the shared success/error envelope and preserves
  backend application error codes and request IDs.
- Axios calls NestJS directly through `NEXT_PUBLIC_API_BASE_URL`. No Next.js
  Route Handler or frontend BFF sits between the browser and the API.
- Message contracts match the backend discriminants: `text`, `event_card`,
  `event_edit`, `event_confirm`, and `event_reject`.
- After every successful message or Draft mutation, the client reloads
  `GET /messages` instead of reconstructing persistent history from React state.
  This also reveals Event Cards persisted during incomplete Agent runs.
- Timeline projection derives each Draft's latest snapshot and its pending,
  confirmed, or rejected state from persisted interactions.
- Only the latest pending Draft snapshot exposes Edit, Confirm, and Reject.
  Incomplete Drafts cannot be confirmed in the UI; NestJS validates again.
- Event editing supports title, local start/end time, timezone, location, and
  description. Title, start time, and IANA timezone are required; an end time
  cannot precede its start. Rejection requires a second explicit click.
- Loading, uncertain delivery, safe API failure, and refresh-required states
  preserve existing timeline content.
- A synchronous client interaction lock serializes message sends and Event Draft
  mutations. React Hook Form submission state and component-local locks also
  close rapid Enter and double-click windows before React rerenders.
- Network and timeout failures are treated as unknown outcomes. The composer
  restores the submitted text, Draft actions remain blocked, and the user must
  reload persisted state before retrying. Non-ambiguous Draft failures reload
  the authoritative timeline before reporting the failure.
- Required Event fields expose native and accessible required semantics. Edit
  and Reject transitions move keyboard focus to the newly mounted control.
- Timeline rows are memoized, offscreen rows use CSS content visibility, and
  Next.js optimizes imports from the Radix barrel used by shadcn/ui.

## Current transition boundary

The current Event Card calls the Phase 3 public Edit, Confirm, and Reject
endpoints directly. When Agent Phase 4 Slice 2 ships, Confirm and Reject are
replaced by the HITL decision API:

- `approve`: execute the proposed confirmation;
- `deny`: do not confirm and leave the Draft pending;
- `reject_event`: replace confirmation with rejection of the same Draft.

Do not keep direct Confirm/Reject and Agent HITL as two public paths after that
migration. Edit may remain a deterministic Draft action.

## Next slices

### Slice 1: Application shell and sidebar

- Add the official shadcn/ui Sidebar primitive and adapt it to the existing
  warm, quiet visual system. Do not import an entire example Block with unused
  workspace, search, history, or breadcrumb features.
- Keep the Event Chat conversation as the existing single-column content area.
  Add an Event Chat navigation item and a separate Settings item.
- Use a collapsible icon sidebar on desktop and the Sidebar mobile Sheet on
  narrow screens.
- Put a placeholder Avatar, username, and email in `SidebarFooter`. Its dropdown
  exposes the working Settings destination only; do not imply that Profile,
  Organization, Logout, or authentication already exist.
- Switch the content area with client-owned section state instead of adding
  routes. Keep Event Chat mounted while Settings is visible so an active Agent
  request and conversation state are not discarded.

Done when desktop and 375px navigation work with keyboard and pointer input,
the sidebar can collapse, the user menu is accessible, and all existing Event
Chat states still behave unchanged.

### Slice 2: Local timezone setting

- Add a React Hook Form and Zod Settings form for one IANA timezone value.
- Detect the browser timezone as the initial default, allow restoring that
  system value, and persist the selected value under a versioned localStorage
  key.
- Feed the selected timezone into future `POST /messages` requests. A request
  already in progress keeps the timezone captured when it was submitted.
- Treat this as a temporary browser preference, not a user profile. NestJS
  remains authoritative for timezone validation and Event interpretation.
- Do not add a UsersModule integration, Settings API, authentication, or a
  database schema in this slice.

Done when invalid timezones cannot be saved, the preference survives reload,
and the next submitted message sends the saved timezone.

## Verification status

- The frontend changes have not been typechecked, linted, built, or inspected
  in a running browser yet.
- Before completion, verify desktop and 375px layouts plus complete, incomplete,
  edited, confirmed, rejected, refresh, and controlled-error flows.
- Durable retry safety after an unknown POST or Draft mutation still requires a
  backend idempotency or operation-status contract. Full-history pagination is
  also deferred until conversation size requires it.
