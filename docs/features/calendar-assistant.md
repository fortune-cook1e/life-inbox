# Calendar Assistant

## Outcome

The Calendar Assistant turns a plain-text request into a structured Event. It extracts supported
facts, asks for information required by the backend, and shows a preview when the Event is ready.

The complete capability will let the user confirm the preview, find the confirmed Event later, and
explicitly export it as an `.ics` file. Confirmation and export are not implemented yet.

## User flow

The current API handles one new request:

```text
User: Remind me to visit the dentist next Friday at 10 AM

-> save the user message
-> create an internal Case
-> propose a calendar Event
-> validate the Event
-> show a preview
```

When required information is missing, the backend saves a `COLLECTING` Event and the Agent asks one
question. The assistant cannot yet consume the answer and continue the same Event.

## Data flow

```text
POST /messages
-> MessagesController validates the request DTO
-> AgentRunService saves the USER ChatMessage
-> LifeInboxAgentService starts a bounded ToolLoopAgent
-> create_case binds the message to a LifeCase
-> propose_calendar_event submits candidate fields
-> Event Gate calculates COLLECTING or READY
-> ask_user or show_event_preview saves an ASSISTANT ChatMessage
-> response mappers return the public Message and Event fields
```

The Agent receives the user text, a fixed reference date, and a default time zone. It has access to
four domain tools: `create_case`, `propose_calendar_event`, `ask_user`, and `show_event_preview`.

The loop stops after a clarification question, an Event preview, or four steps. OpenAI calls stay
outside database transactions.

## Domain model

`ChatMessage` stores the conversation and user evidence. `LifeCase` is the hidden context boundary
for one matter. `Event` stores the current calendar candidate, with at most one Event per Case. The
public API keeps `caseId` internal. The client supplies `clientMessageId` when creating a message,
but message responses omit it.

The current Event states are:

- `COLLECTING`: one or more required fields are missing.
- `READY`: the backend Event Gate accepted all required fields.

The current required fields are `title`, `startAt`, and `timeZone`. `endAt` and `location` are
optional.

## Invariants

- One input message is bound to at most one LifeCase.
- One LifeCase has at most one Event.
- Only the backend Event Gate decides whether an Event is `COLLECTING` or `READY`.
- A `READY` Event has a title, start time, and valid IANA time zone.
- An end time must be later than the start time.
- A failed model call does not delete the user's original message.
- Repeated Agent tool calls do not create duplicate Cases or Events.
- The Agent cannot confirm an Event or perform an external calendar action.

PostgreSQL constraints protect the Event relationship, required READY fields, time range, and
non-blank text. Backend tools validate the same domain transitions before persistence so the Agent
receives a useful result instead of relying on a database error.

## Implementation status

Completed:

- Validate and save plain-text messages with optional IANA time zones.
- Run a bounded AI SDK Agent loop with an OpenAI provider.
- Derive titles and resolve dates with a reference date and default time zone.
- Create and validate one Event for one Case.
- Ask one clarification question or show an Event preview.
- Preserve user evidence when the model provider fails.
- Recover from an early preview and repeated Case or Event tool calls.

Remaining:

- Continue the same Case and Event after a clarification answer.
- Load Case-scoped Messages and Event state as working memory.
- Connect the Web chat to the API.
- Confirm or ignore an exact Event version.
- Query confirmed Events.
- Export a confirmed Event as `.ics` through an explicit action.
- Define recovery for duplicate HTTP submissions and interrupted Agent runs.

Files, images, automatic Case matching, Calendar provider writes, and other assistant capabilities
are outside this feature's current scope.

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
```

## Maintenance

Update this document when the Calendar Assistant changes its user flow, domain invariants, tool
contract, failure behavior, or proof. Slice-by-slice progress and details already clear from the code
do not belong here.
