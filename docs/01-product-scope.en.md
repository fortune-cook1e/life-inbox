# LifeInbox Product Scope and Principles

[中文](01-product-scope.md)

## 1. Product overview

LifeInbox is an inbox for personal life notices.

Users paste everyday notices such as housing inspections, university deadlines, medical appointments, parcel pickups, return deadlines, or subscription renewals. LifeInbox preserves the source, proposes structured actions, asks for clarification when information is missing, and helps export confirmed plans to Apple Calendar.

Its core promise is:

> Understand and schedule an important life notice in under thirty seconds, without silently inventing dates or acting without confirmation.

## 2. Primary user and initial context

The first user is the product developer. The initial context is an individual living in Sweden who receives English, Swedish, and Chinese notices. The default time zone is `Europe/Stockholm`.

V1 is local-first and single-user. It becomes remotely usable across devices only after V2 adds authentication and owner-only authorization.

## 3. Problem statement

Everyday notices mix context, dates, requirements, and irrelevant text. The user must determine:

- Does this require action?
- Is it an appointment, deadline, or flexible reminder?
- Which date is the event date rather than the message date?
- What is the next step?
- Should it occupy calendar time?
- Which source text supports the extracted result?

Copying this information into a calendar is small but repetitive work, and missing a date can cause real loss.

## 4. Core journey

```text
Paste notice
-> preserve original text
-> extract zero or more action drafts
-> show evidence and missing fields
-> user edits and confirms
-> propose an Apple Calendar event
-> user explicitly exports .ics
-> user marks the item planned, done, or ignored
```

Later versions extend rather than replace this journey:

```text
Receive a related new notice
-> find the existing item
-> identify an update, cancellation, or new requirement
-> show old and proposed values
-> user confirms the change
```

## 5. Action types

### Appointment

A time-bounded event that occupies calendar time, such as a 10:00-12:00 apartment inspection, a 14:30 dentist appointment, or a 09:00-10:00 interview.

Required information: date, start time, end time or an explicitly approved default duration, and time zone.

### Deadline

Something that must be completed by a date but does not necessarily occupy a specific hour, such as submitting registration by July 30 or returning an item by August 5.

V1 represents date-only deadlines as all-day events. It must not invent midnight UTC as if the source contained a precise time.

### Reminder

A flexible action scheduled by the user, such as contacting a landlord next week or reviewing a subscription before renewal. If the source is ambiguous, the system asks for a date rather than guessing.

### No action

Some messages are informational only. `NO_ACTION` is valid; the model must not force every input into a calendar event.

## 6. V1 product surfaces

### Inbox

- Paste a notice.
- View recent notices and actions.
- Filter by `Needs review`, `Planned`, `Done`, and `Ignored`.
- Warn when identical source text appears to have been submitted again.

### Review

- Display immutable source text.
- Display one or more AI-proposed action drafts.
- Show source evidence for important fields.
- Show missing or conflicting fields.
- Allow every proposed value to be edited.
- Confirm, ignore, or request a retry.
- Preview and export an Apple Calendar `.ics` file.

### Settings

- Default time zone.
- Default appointment duration.
- Default reminder lead time.
- Preferred language for summaries and questions.
- Data deletion controls after accounts are introduced.

## 7. Product principles and invariants

### Preserve before interpreting

The original notice is retained. AI output never replaces it.

### Draft before fact

AI output is always a draft. Only user confirmation creates authoritative action data.

### Keep uncertainty visible

Unknown or conflicting dates, missing times, and model failures remain visible states rather than becoming apparently certain values.

### Important fields require evidence

Dates, times, locations, deadlines, and required actions point to source text or user-provided clarification.

### Humans control external side effects

The system cannot export or write calendar events without an explicit user action.

### Represent external state honestly

The web app can know that it generated an `.ics` file, but not that the user imported it into Apple Calendar. Product state must preserve this distinction.

### Reliability before autonomy

Reliable storage, review, testing, and failure recovery come before open-ended agent loops.

### Privacy by default

Notices may be private. Logs must not contain full notice text, access tokens, signed URLs, or document contents by default.

## 8. Initial success metrics

Calibrate numeric targets only after collecting a small real dataset. Track:

- Percentage of model outputs that pass schema validation.
- Accuracy for explicit dates and times.
- Correct refusal to guess ambiguous time expressions.
- Percentage of important fields with valid source evidence.
- Field edit rate before confirmation.
- Time from paste to confirmed action.
- Manual `.ics` generation and Apple Calendar import success.
- LLM latency, error rate, token usage, and estimated cost.

## 9. Five-minute product demo

1. Paste a Swedish or English housing-inspection notice.
2. Show the preserved source.
3. Show extracted date, time, location, next action, and evidence.
4. Correct one intentionally ambiguous field.
5. Confirm the action.
6. Export `.ics`.
7. Open it in Apple Calendar.
8. Return to LifeInbox and mark the action planned.
9. Show extraction metadata and the audit/history view.

## 10. Non-goals

V1 does not include:

- Automatic access to Apple Mail or the user's whole inbox.
- Direct iCloud login or stored Apple credentials.
- Native iOS or macOS applications.
- PDF, screenshot, OCR, or `.eml` parsing.
- Team collaboration, family sharing, or RBAC.
- Redis, queues, workers, or vector retrieval.
- A general chat interface.
- Multi-agent orchestration.
- GraphRAG, fine-tuning, or self-hosted inference.
- Automated medical, legal, immigration, or financial decisions.

Advanced versions remain focused on life notices; they do not turn LifeInbox into an unbounded personal assistant.
