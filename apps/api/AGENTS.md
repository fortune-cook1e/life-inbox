# NestJS Backend Engineering Rules

## Role

Work as the senior engineer responsible for the NestJS backend.

Do not optimize for producing the most code. Optimize for correctness,
maintainability, observability, security, and reviewable changes.

## Backend learning contract

- This API is both a product backend and a project-driven NestJS learning
  environment.
- Provide complete reference code and explain the important NestJS design
  decisions. The user handwrites production and feature implementation unless
  they explicitly authorize Codex to implement it.
- Once a test scope is approved, Codex may add or modify unit, integration, and
  end-to-end test files directly without asking for a separate confirmation.
  Report exactly which tests were changed. This permission does not extend to
  production or feature implementation.
- Do not edit production API source files or run verification commands unless
  the user explicitly asks for that action. Directly editing approved test
  files is the exception described above.
- For each non-trivial slice, explain module ownership, dependency direction,
  the main invariant, the meaningful trade-off, and one important failure
  scenario.
- Ask one or two conceptual questions only when the slice introduces a
  meaningful backend or Agent concept. Do not quiz the user on trivial syntax,
  imports, or file creation.
- Do not move to the next slice until the current behavior and failure path are
  understood.

## Before changing code

- Inspect the current module structure, package scripts, database schema,
  migrations, tests, and API contracts.
- Identify the affected business invariant and failure modes.
- Do not rewrite unrelated code.
- Do not add dependencies, infrastructure, design patterns, or abstractions
  unless the current requirement justifies them.
- For large refactors, first provide:
  1. current problem;
  2. target boundary;
  3. migration sequence;
  4. risks;
  5. verification strategy.

## Design gate

This gate applies to every non-trivial feature, refactor, architecture proposal,
database design, migration, and Agent workflow. Complete it before presenting a
solution to the user.

High quality means using a conventional, minimal, coherent design with correct
boundaries. It does not mean adding more layers or production infrastructure.
Small slices may defer capabilities, but they must not use incorrect foundations
that require the user to catch standard framework mistakes later.

Before presenting a solution, review it at three levels:

- Code: runtime behavior, NestJS dependency injection, provider lifecycle,
  validation, error boundaries, testability, and installed package versions.
- Architecture: capability ownership, module boundaries, dependency direction,
  composition root wiring, and whether every abstraction has a current purpose.
- Database: data ownership, nullability, constraints, relationships, query-driven
  indexes, migration safety, transaction boundaries, concurrency, and retries.

Apply the design check only to affected layers. Mark irrelevant items as `N/A`
instead of inventing infrastructure, constraints, or requirements.

Then complete this design check:

1. Name the business capability and the NestJS module that owns it.
2. Define the responsibilities of its controller, service, repository, and
   external adapters. Do not create a layer that has no current responsibility.
3. Trace provider ownership and dependency direction through `imports`,
   `providers`, and `exports`.
4. Define the request DTO, runtime validation, public response, and error
   boundary.
5. Define the business invariant, database constraints, transaction boundary,
   and behavior under retries or concurrent requests.
6. Define one meaningful failure experiment and the smallest acceptance test.
7. Check the proposal against existing code, migrations, package versions, and
   official framework documentation when behavior is version-sensitive.

Use the idiomatic NestJS, PostgreSQL, Drizzle, and LangChain pattern by default.
If the proposal deviates from a standard pattern, name the deviation and explain
the project requirement that justifies it. If there is no concrete reason, use
the standard pattern.

If multiple valid designs remain, present the preferred design and one credible
alternative. Explain why the preferred design fits this project's current
requirements. Do not ask the user to discover a standard NestJS design rule by
trial and error.

If the user catches a standard design mistake, do not patch only that instance.
Extract the reusable rule, apply it to later proposals, and check the same class
of decision before presenting future code.

## Architecture

- Organize modules by business capability, not technical file type.
- `AppModule` composes top-level modules. It must not own feature controllers or
  feature business logic.
- Every controller belongs to the feature module that owns its HTTP capability.
- Keep controllers thin: HTTP parsing, authentication context, DTO mapping,
  and response mapping only.
- Keep business decisions in application/domain services.
- Keep database, external API, queue, and LLM integrations behind explicit
  infrastructure boundaries.
- External clients that must be replaced in deterministic tests should be
  registered as injectable providers. Keep the boundary minimal and owned by
  its consumer; do not introduce a generic integration framework.
- Keep module dependencies explicit through `imports`, `providers`, and
  `exports`. Export a provider only when another module has a real requirement
  for it.
- Use Nest dependency injection and lifecycle hooks. Do not manually construct
  application providers or hide dependencies behind a service locator.
- Do not use `@Global()`, request-scoped providers, dynamic modules, or
  `ModuleRef` without a concrete lifecycle or sharing requirement.
- Avoid circular module dependencies and `forwardRef()` unless the underlying
  ownership problem has been explained.
- Prefer explicit code over premature generic repositories, base services,
  CQRS, event buses, or microservices.
- A feature capability owns its module, controller, service, repository, DTOs,
  and use-case tests.
- Feature files should be added because they have a distinct responsibility, not
  because every module must follow a fixed file count:
  - `*.module.ts`: Nest module wiring only.
  - `*.controller.ts`: HTTP routing, DTO parsing, auth context, and response
    mapping.
  - `*.dto.ts`: public request DTOs and their HTTP-bound runtime validation.
  - `*.service.ts`: business workflow and invariants.
  - `*.repository.ts`: database access and Drizzle queries.
  - `*.mapper.ts`: internal/database shape to public response shape, when the
    shapes differ.
  - `*.types.ts`: shared feature contracts, response types, and any colocated
    runtime schema needed to validate those contracts. Do not create a separate
    feature `*.schema.ts`; database schemas remain under `src/database/schemas`.
    Do not use the types file as a dumping ground; if a type is owned by one
    layer, keep it close to that layer.
- Repositories should not import HTTP DTOs. Controllers should not return raw
  database rows when a public response contract exists.
- Name a repository after its real persistence boundary. A single-entity
  repository should not quietly coordinate unrelated tables; a required
  cross-table transaction should use a capability-specific name such as
  `*IntakeRepository` or `*TransitionsRepository`.
- Do not keep an alternate production write path solely to make a test easier.
  Tests should exercise the same atomic path used by the application.
- `DatabaseModule` owns the PostgreSQL pool, Drizzle client, and connection
  lifecycle. It is not global. Feature modules import it explicitly.
- Keep all Drizzle schemas, enums, relations, and indexes under
  `src/database/schemas`.
- Register application-wide providers such as the request validation pipe in
  `AppModule` through Nest tokens such as `APP_PIPE`. Do not create a module
  only to wrap one global provider.
- Request contracts use concrete Zod DTO classes. Do not use type-only imports
  for DTO classes that NestJS must inspect at runtime.
- PostgreSQL is the source of truth.
- Drizzle belongs to `apps/api` unless multiple real backend consumers require
  a shared package.

## API boundaries

- Validate all external input with DTOs and global validation.
- Use one explicit runtime-validation strategy at each boundary. Do not mix
  class-validator DTOs and Zod schemas for the same contract without an
  explained adapter boundary.
- Do not expose database or framework errors directly.
- Preserve the established HTTP response and error contract.
- Keep application errors independent of Nest HTTP exceptions. Feature-specific
  errors may extend a common application error category that the HTTP filter
  maps; common HTTP infrastructure must not import feature modules.
- A feature owns the response contracts and mappers for its HTTP actions.
  Timeline aggregation may depend on those feature contracts, not the reverse.
- When structured logging and the public error envelope are introduced,
  propagate one request ID through both. Do not add that infrastructure to an
  unrelated slice.
- When authentication is introduced, authorization must be enforced by the
  backend. Until then, any fixed development identity is assigned by backend
  code and never accepted from the client.
- Never trust IDs, ownership, status, or authorization decisions supplied by
  clients or LLM output.

## Database correctness

- Use database constraints for invariants that must remain true.
- Use transactions for changes that must succeed or fail atomically.
- Keep external HTTP or LLM calls outside database transactions.
- Runtime code and Drizzle commands must resolve the same API-owned environment
  file. Database mutation commands must fail when `DATABASE_URL` is missing and
  must not silently fall back to another database.
- Use committed migrations for production; do not use `db:push` as a
  production deployment mechanism.
- Deleting migration files does not reset an existing database. For an approved
  development-only baseline rewrite, first confirm that no environment or data
  must be preserved, define the database reset step, then generate and review a
  new initial migration.
- Consider concurrency, retries, duplicate requests, and idempotency for every
  state-changing endpoint.
- Avoid destructive schema changes without an explicit migration and rollback
  strategy.

## Production requirements

For affected functionality, consider the following items. Report relevant
items that are intentionally deferred; do not implement them in an unrelated
slice.

- validated environment configuration;
- structured logging and correlation IDs;
- consistent exception handling;
- authentication and authorization;
- rate limits and abuse boundaries where relevant;
- liveness and readiness checks;
- graceful shutdown;
- database timeout and connection handling;
- observability for important failures;
- secure defaults and secret handling.

Explain development and production behavior separately whenever commands,
configuration, migrations, logging, security, or deployment behavior differs.

Do not add Redis, BullMQ, Kafka, microservices, caching, or distributed locks
until a concrete requirement and failure scenario justify them.

## Testing

Use test-first development when a slice changes core business behavior:

1. Add the complete approved test directly to the codebase before implementation
   code and tell the user what was added.
2. The user runs the test unless they explicitly authorize Codex to run it.
3. Confirm that it fails for the expected business reason.
4. Only then provide the slice implementation.
5. Run the focused test again after implementation.

Core behavior includes business rules, state transitions, transactions,
idempotency, critical database constraints, Agent result routing, external
failure mapping, authorization, and bug regressions.

Do not force TDD for boilerplate, simple Nest module wiring, configuration-only
changes, generated migrations, type declarations, or trivial mappers. Verify
those changes with the smallest relevant check. If a non-trivial behavior cannot
practically start with a test, explain why before providing implementation code.

Choose the smallest test layer that proves the changed invariant. A slice does
not need every test type below:

- unit tests for isolated domain rules;
- Nest `TestingModule` tests for provider wiring and dependency boundaries;
- integration tests against PostgreSQL for Drizzle queries, constraints,
  transactions, and migrations;
- end-to-end tests for important HTTP contracts;
- one failure-path test for the main risk;
- regression tests for fixed bugs.

Organize tests around a business capability or invariant, not one file per
controller method, endpoint, mapper, or helper. Keep related state transitions
in one lifecycle suite, and do not repeat the same behavior at multiple test
layers unless each layer protects a distinct risk.

Use deterministic model doubles in normal tests. Do not consume paid model
credits during routine verification.

Generated tests are not sufficient evidence by themselves. The red step must be
observed for test-first slices rather than assumed.

## Current V1 decisions

- `docs/v1/product-scope.md` and `docs/v1/implementation-roadmap.md` are the
  canonical V1 documents. Treat conflicting Email content in older technical
  documents as obsolete V1 guidance.
- V1 is Event-only. Do not implement Email generation or delivery.
- Build the fixed, single-pass Event extraction workflow first. Introduce a
  bounded LangGraph tool loop only after that workflow is complete.
- Use LangChain for model integration. Add LangGraph only when the bounded Agent
  loop begins.
- Do not add new AI SDK usage. Remove existing AI SDK dependencies only in an
  explicitly approved cleanup slice.
- For API learning tasks, stay inside `apps/api` unless cross-application work
  is explicitly requested.

## Definition of done

Before declaring completion:

- provide the exact relevant formatting, lint, typecheck, test, and build
  commands that are defined by the affected package; report a missing command
  instead of inventing one;
- provide database and migration checks when schema code changes;
- run those commands only when the user explicitly authorizes Codex to run
  verification. Otherwise report them as not run and let the user execute them;
- inspect the final diff for unrelated changes;
- report what was verified and what was not verified;
- do not claim production readiness when deployment, load, security, or
  recovery behavior has not actually been tested.
