# LifeInbox web application instructions

## Scope

These instructions apply to `apps/web` and supplement the repository root
`AGENTS.md`. The web application uses Next.js App Router, React, Tailwind CSS,
shadcn/ui, React Hook Form, Zod, Axios, and Zustand.

The frontend renders Event interactions for V1, but application naming and shell
architecture must not imply that LifeInbox will always be Event-only. NestJS and
PostgreSQL remain authoritative for business state; React owns rendering and
temporary interaction state.

Read `docs/HANDOFF.md` and `docs/HANDOFF-FRONTEND.md` before planning or
implementing frontend work.

## Directory architecture

Use route-first UI co-location with shared infrastructure:

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── (app)/
│       ├── layout.tsx
│       ├── _components/       # shared only by routes in this group
│       ├── event-chat/
│       │   ├── page.tsx
│       │   ├── _components/   # Event Chat UI only
│       │   └── _hooks/        # Event Chat hooks only, when needed
│       └── settings/
│           ├── page.tsx
│           └── _components/   # Settings UI only, when needed
├── components/
│   └── ui/                    # shared design-system primitives
├── stores/                    # cross-route Zustand application state
├── services/                  # backend API boundaries
├── types/                     # frontend API and persisted-data contracts
└── lib/                       # shared infrastructure and pure utilities
```

Do not create directories preemptively. Add a directory only when it owns a
current file and responsibility.

## File ownership

- Route-specific UI belongs beside its App Router page under `_components`.
- Components shared only by routes in one route group belong in that route
  group's `_components`.
- `src/components/ui` owns shadcn/ui and other application-wide design-system
  primitives. Do not place feature components there.
- Do not create a top-level feature component folder by default.
- A component does not need multiple consumers when extraction creates a real
  rendering, lifecycle, accessibility, form, or performance boundary.
- Do not extract a page into a same-named component used only by that page when
  `page.tsx` would only forward to it and no meaningful boundary is created.
- Keep API services in `src/services`, contracts in `src/types`, shared stores in
  `src/stores`, and infrastructure or pure shared utilities in `src/lib` unless
  a separately approved architecture change establishes a different owner.

Moving one category does not authorize moving adjacent categories. In
particular, moving page components does not authorize moving services, types,
stores, hooks, or utilities.

## Dependency direction

Prefer this dependency direction:

```text
App Router page or layout
  -> route-owned component
  -> Zustand store and/or API service
  -> API client and contracts
  -> shared UI primitives
```

Additional rules:

- Top-level services, stores, types, and libraries must not import route-private
  `_components` or `_hooks`.
- One route must not import another route's private files.
- When two routes gain a real shared responsibility, propose moving that code to
  their nearest shared owner before changing its location.
- Import shared primitives directly from their files; do not add broad barrel
  exports solely for shorter imports.

## App Router boundaries

- `page.tsx` is the route composition root and may contain page-specific
  implementation directly.
- Use route groups for shared layouts without changing public URLs.
- Keep shared navigation and shell UI in the nearest shared route-group layout.
- Preserve Server Components by default. Add `"use client"` only where browser
  APIs, event handlers, React client hooks, or client stores require it.
- Do not add routes, layouts, providers, or wrapper components without a current
  navigation, ownership, or lifecycle requirement.

## State ownership

- Use React state for component-local visual interaction state.
- Use React Hook Form for form state and Zod for client-side form validation.
- Use Zustand for mutable state that must survive route transitions or is shared
  across independent frontend areas.
- Keep cross-route Zustand stores under `src/stores` and name them by the state
  responsibility they own, not by a generic `global` or `app` label.
- Do not use React Context as a mutable global application-state store.
  Framework and design-system primitives may use Context internally when that is
  their conventional composition mechanism.
- Do not mirror every local state value into Zustand. Dropdown, focus, hover,
  editor mode, and isolated form fields remain local unless a current workflow
  requires cross-route ownership.
- Use narrow Zustand selectors, or `useShallow` for a stable group of related
  selections, rather than subscribing a component to the entire store.
- A Zustand store is not authoritative business storage. Reload persisted
  timeline and Event state from the API after successful mutations.
- Document and implement an explicit reset or ownership boundary before adding
  authenticated multi-user state to a module-level client store.

## API and data flow

The browser calls NestJS directly through the configured Axios client:

```text
route UI
  -> Zustand action or route event handler
  -> service in src/services
  -> NestJS API
  -> reload authoritative persisted state
  -> render
```

- Do not add a Next.js BFF or Route Handler without a current requirement.
- Consume the shared API envelope and preserve backend error codes and request
  IDs.
- Treat network and timeout failures as unknown outcomes when the backend may
  have committed the operation.
- Do not reconstruct authoritative Event state from optimistic client claims.

## Product naming

- Treat the current repository and workspace name as an internal identifier, not
  a phrase that generic UI and infrastructure copy must repeat.
- Use brand-neutral wording for API errors, assistant labels, forms, settings,
  metadata, and reusable components unless a dedicated branding surface has an
  explicitly approved product name.
- Do not rename workspace packages, imports, repository paths, or backend
  contracts as part of a UI-copy change.

## UI implementation

- Use shadcn/ui as the design-system boundary instead of recreating primitives
  in feature folders.
- Preserve keyboard access, visible focus, semantic landmarks, labels, and
  required-field semantics.
- Keep mobile behavior, including a 375px viewport, in the acceptance scope for
  navigation and forms.
- Apply the repository's `vercel-react-best-practices` skill when writing or
  reviewing React and Next.js code.
- Avoid speculative memoization. Use it where an observed or structurally clear
  rendering boundary justifies it, such as long timeline rows.

## Change scope and authorization

- Implement only the explicitly approved frontend slice.
- Do not interpret a request to reorganize one folder as authorization to
  reorganize the whole frontend.
- Propose cross-directory moves separately when they alter ownership beyond the
  requested category.
- Preserve unrelated staged, unstaged, and untracked work.
- Do not add dependencies unless the user explicitly requests the capability
  that requires them.
- Do not add routes, state infrastructure, abstractions, or product behavior for
  hypothetical future capabilities.
- Update `docs/HANDOFF-FRONTEND.md` after a completed frontend slice or when an
  approved decision changes the active architecture.

## Verification

Run frontend verification only when the user explicitly authorizes it. The
relevant package commands are:

```bash
pnpm --filter @life-inbox/web typecheck
pnpm --filter @life-inbox/web lint
pnpm --filter @life-inbox/web build
```

Browser acceptance for navigation or responsive work must cover desktop and
375px layouts with keyboard and pointer input. Do not claim browser behavior was
verified unless it was actually inspected.
