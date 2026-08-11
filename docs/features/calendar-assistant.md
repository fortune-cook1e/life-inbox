# Calendar Assistant

## Outcome

The Calendar Assistant turns a plain-text request into a structured Event. It extracts supported
facts, asks for information required by the backend, continues the same Event when the user answers,
and shows a preview when the Event is ready.

The complete capability will let the user confirm the preview, find the confirmed Event later, and
explicitly export it as an `.ics` file. Confirmation and export are not implemented yet.

## User flow

The API handles a complete new request:

```text
User: Remind me to visit the dentist next Friday at 10 AM

-> save the user message
-> create an internal Case
-> propose a calendar Event
-> validate the Event
-> show a preview
```

When required information is missing, the backend saves a `COLLECTING` Event and atomically stores
one open PendingQuestion with the assistant question. A later fragment such as `At 10 AM` first
searches recent compatible pending questions. Exactly one compatible candidate updates the original
Event; ambiguous or unmatched fragments request a self-contained restatement instead of creating a
duplicate Case.

Date-only input is retained as partial temporal state. The backend stores 09:00 in the user's time
zone with `DATE_ONLY` precision, keeps the Event `COLLECTING`, and asks for the real time. A later
date-only or time-only answer updates the same Event. `next <weekday>` means that weekday in the
next calendar week.

## Data flow

```text
POST /messages
-> MessagesController validates the request DTO
-> AgentRunService saves the USER ChatMessage
-> LifeInboxAgentService starts a bounded ToolLoopAgent
-> clear new matter: create_case -> propose_calendar_event
-> possible answer: search_pending_questions -> apply_clarification_answer
-> Event Gate calculates COLLECTING or READY
-> ask_user or show_event_preview saves an ASSISTANT ChatMessage
-> request_restatement asks for matter + value without binding a Case
-> finish_message_only stores no additional state
-> AgentRunService reloads the input after a continuation may bind it
-> response mappers return the public Message and Event fields
```

The Agent receives the user text, a fixed reference date, and a default time zone. It has access to
bounded domain tools for Case/Event creation, pending-question search and answer application,
clarification, preview, restatement, and message-only completion. Candidate search returns at most
two run-local aliases and never exposes Case or PendingQuestion IDs.

The loop stops after a clarification question, Event preview, restatement request, message-only
result, or four steps. OpenAI calls stay outside database transactions.

## Domain model

`ChatMessage` stores the conversation and user evidence. `LifeCase` is the hidden context boundary
for one matter. `Event` stores the current calendar candidate, with at most one Event per Case.
`PendingQuestion` records which required Event field one assistant question is waiting for, at which
Event version, and which user message eventually resolved it. The public API keeps Case and
PendingQuestion identifiers internal. The client supplies `clientMessageId` when creating a message,
but message responses omit it.

The current Event states are:

- `COLLECTING`: one or more required fields are missing.
- `READY`: the backend Event Gate accepted all required fields.

The current required fields are `title`, a `DATE_TIME`-precision `startAt`, and `timeZone`.
`endAt` and `location` are optional, but an explicitly supplied date-only `endAt` remains missing
until its time is collected.

## Invariants

- One input message is bound to at most one LifeCase.
- One LifeCase has at most one Event.
- One Event has at most one `OPEN` PendingQuestion.
- Question creation and pending state commit atomically.
- Event patch, answer binding, version increment, and pending resolution commit atomically.
- A clarification answer can patch only its PendingQuestion's recorded missing field.
- Only the backend Event Gate decides whether an Event is `COLLECTING` or `READY`.
- A `READY` Event has a title, explicit start time, and valid IANA time zone.
- A 09:00 timestamp with `DATE_ONLY` precision is internal partial state, not a user-confirmed time.
- A present end date must also have `DATE_TIME` precision before the Event becomes `READY`.
- An end time must be later than the start time.
- A failed model call does not delete the user's original message.
- Repeated Agent tool calls do not create duplicate Cases or Events.
- Ambiguous answers do not change any candidate Event or PendingQuestion.
- The Agent cannot confirm an Event or perform an external calendar action.

PostgreSQL constraints protect the Event relationship, required READY fields, time range, and
non-blank text. Backend tools validate the same domain transitions before persistence so the Agent
receives a useful result instead of relying on a database error.

## Implementation status

Completed:

- Validate and save plain-text messages with optional IANA time zones.
- Run a bounded AI SDK Agent loop with an OpenAI provider.
- Derive titles and resolve dates with a reference date and default time zone.
- Preserve date-only start/end values with explicit temporal precision and collect their times over
  multiple turns.
- Create and validate one Event for one Case.
- Ask one clarification question or show an Event preview.
- Persist one versioned open PendingQuestion for a blocking required field.
- Search at most two recent candidates with bounded Case context and run-local aliases.
- Apply one compatible answer to the original Event and bind its Message to the original Case.
- Request a self-contained restatement for ambiguous or unmatched fragments.
- Store meaningless or non-actionable text as `MESSAGE_ONLY`.
- Preserve user evidence when the model provider fails.
- Recover from an early preview and repeated Case or Event tool calls.
- Connect the Web chat to `GET /messages` and `POST /messages` through a same-origin proxy, with
  optimistic user messages, clarification replies, and in-session Event cards.

Remaining:

- General historical Case matching beyond open PendingQuestions.
- Return Event context with message history so a reload can reconstruct structured preview cards.
- Confirm or ignore an exact Event version.
- Query confirmed Events.
- Export a confirmed Event as `.ics` through an explicit action.
- Define recovery for duplicate HTTP submissions and interrupted Agent runs.

Files, images, automatic Case matching, Calendar provider writes, and other assistant capabilities
are outside this feature's current scope.

## Clarification continuation decisions

### Continue only one compatible pending matter

Problem: A short answer such as `At 10 AM` may refer to more than one unfinished Event. Choosing the
most recent row would silently mix evidence between Cases.

Decision: Search only open required-field questions on open Cases and collecting Events. Return at
most two candidates under run-local aliases. The model may apply an answer only when exactly one
candidate is semantically compatible; otherwise it asks for a self-contained `matter + value`
restatement and changes no candidate state.

Proof: Integration tests create two open `startAt` questions and submit only `10 AM`. Both Events and
PendingQuestions remain unchanged and the new user Message stays Case-less. A separate test submits
`Dentist at 10 AM` and verifies that only the dentist Event changes.

### Resolve an answer as one atomic state transition

Problem: Updating the Event before binding the answer or resolving the PendingQuestion could leave
contradictory state after a failure or concurrent answer.

Decision: Lock the PendingQuestion, Event, and input Message. Revalidate status, Event version,
missing field, and normalized value. Then patch exactly one field, increment the Event version, bind
the answer, and resolve the PendingQuestion in one transaction.

Proof: A concurrency test submits two valid answers to the same PendingQuestion. Exactly one update
succeeds; the losing Message stays unbound.

## Challenges and decisions

### Keep Event status under backend control

Problem: A model can claim that an Event is complete or attempt to show a preview too early.

Decision: The proposal tool accepts candidate fields but no status. The Event Gate normalizes the
candidate, validates it, and calculates `COLLECTING` or `READY`. The preview tool reloads the Event
and runs the Gate again.

Proof: A test makes the Agent call `show_event_preview` before proposing an Event. The backend
rejects the call, and the Agent recovers by proposing the Event and asking for the missing field.

### Make repeated Agent tool calls safe

Problem: A probabilistic model can call `create_case` or `propose_calendar_event` more than once in
the same run. A duplicate call previously ended the request with a database error.

Decision: Case creation locks and reloads the input message. Event creation uses the unique Case
constraint and reloads the existing Event after a conflict. A repeated call returns authoritative
stored state.

Proof: Integration tests repeat each tool and assert that the request still returns one Case, one
Event, and one preview.

Tradeoff: This protects tool execution inside an Agent run. It does not restore HTTP request replay
for a repeated `clientMessageId`.

### Preserve evidence across model failure

Problem: OpenAI can fail after the user submits a message. Removing the message would discard the
only evidence of what the user asked.

Decision: Save the user message before starting the Agent. Keep model calls outside database
transactions. Return a service-unavailable response when the run cannot finish.

Proof: The provider-failure test verifies that the user message and created Case remain while no
Event or assistant reply is added.

Tradeoff: Preserving evidence can leave an unfinished Case. Recovery and resume behavior belong to
a later slice.

## Verification

The API uses Vitest with a deterministic mock language model. Normal tests do not call OpenAI or
consume paid credits.

The integration suite covers:

- Complete input that produces a READY Event preview
- Missing time that produces a COLLECTING Event and clarification question
- Unique clarification answer that updates the original Event
- Still-incomplete answer that opens the next required question
- Ambiguous fragment and self-contained restatement routing
- Unmatched fragment and message-only outcomes
- Concurrent answers with at most one atomic update
- User-provided and default time zones
- Natural-language title and date extraction
- Invalid Event proposals and the four-step limit
- Early preview rejection and Agent recovery
- Repeated Case and Event tool calls
- Provider failure with preserved evidence
- Public response fields and stable message pagination

Run the feature checks with:

```bash
pnpm --filter @life-inbox/api test
pnpm --filter @life-inbox/api lint
pnpm --filter @life-inbox/api typecheck
pnpm --filter @life-inbox/api build
pnpm --filter @life-inbox/web lint
pnpm --filter @life-inbox/web typecheck
pnpm --filter @life-inbox/web build
```

## Maintenance

Update this document when the Calendar Assistant changes its user flow, domain invariants, tool
contract, failure behavior, or proof. Slice-by-slice progress and details already clear from the code
do not belong here.
