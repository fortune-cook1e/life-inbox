# Event Assistant V1: Product Scope

## 1. Goal

V1 is an Event Assistant with one persistent conversation per user.

The first version contains one capability:

- Event workflow, followed by a bounded Event Agent

The goal is to build a small but complete human-in-the-loop workflow before introducing more advanced capabilities such as memory, RAG, or multi-agent collaboration.

---

## 2. User Interaction

The user can enter arbitrary natural-language text.

Examples:

```text
Remind me to submit my assignment tomorrow at 3 PM.
```

```text
I have a meeting at Ericsson this Friday at 10 AM.
```

```text
The weather is nice today.
```

The assistant determines whether the input contains an event-related intent.

### 2.1 No Event Intent

If the message is unrelated to Event creation, no Event action is triggered.

```text
User Message
    ↓
Event Intent Check
    ↓
Event-only Fallback Response
```

The response is stored as part of the interaction history.

V1 does not provide open-domain assistant answers. It returns a short response explaining that it can help create Events.

### 2.2 Event Intent Detected

If the message contains an Event intent:

```text
User Message
    ↓
LLM
    ↓
Event Information Extraction
    ↓
Event Card
```

The LLM extracts as much information as possible from the user's message.

The initial fixed workflow does **not** ask follow-up questions for missing information.

Missing fields remain empty and can be completed manually by the user directly in the Event Card.

A later V1 phase may add focused clarification through a bounded Event Agent after the fixed workflow is working.

---

## 3. Event Model

An Event represents something that should happen at a specific time.

An Event may represent:

- a meeting
- an appointment
- a deadline
- a reminder
- another time-based activity

V1 does not introduce a separate Reminder entity.

A reminder can simply be represented as an Event without an end time or location.

---

## 4. Event Fields

### 4.1 Required Fields

The following fields are required before an Event can be confirmed:

- Title
- Start Date
- Start Time
- Timezone

### 4.2 Optional Fields

The following fields are optional:

- End Date
- End Time
- Location
- Description

For example, this is a valid Event:

```text
Title: Project Meeting
Start: 2026-08-20 15:00
End: 2026-08-20 16:00
Location: Ericsson
Timezone: Europe/Stockholm
```

This is also a valid Event:

```text
Title: Submit Assignment
Start: 2026-08-20 15:00
End: Not set
Location: Not set
Timezone: Europe/Stockholm
```

---

## 5. Timezone

Every Event must have a timezone.

By default, the system uses the user's current timezone.

The timezone should use an IANA timezone identifier.

Example:

```text
Europe/Stockholm
```

Avoid representing the user's timezone only as:

```text
UTC+2
```

because fixed UTC offsets cannot correctly represent daylight-saving time changes.

The Event Card should display the timezone so that the user can verify or edit it before confirmation.

---

## 6. Event Card

When an Event intent is detected, the assistant displays an editable Event Card.

Example:

```text
Project Meeting

Date        Aug 20, 2026
Start       15:00
End         16:00
Location    Ericsson
Timezone    Europe/Stockholm
Description Not set

[Confirm] [Edit] [Reject]
```

The card represents a proposed Event, not an already-created Event.

---

## 7. Event Human-in-the-Loop Interaction

The Event Card supports three actions:

- Confirm
- Edit
- Reject

### 7.1 Confirm

The user can confirm the Event only when all required fields are complete and valid.

```text
Confirm
    ↓
Create Event
```

The confirmed values become the final Event data.

### 7.2 Edit

The user can directly modify the fields in the Event Card.

Example:

```text
LLM extracted:

Start: 15:00
End: Not set
```

The user changes it to:

```text
Start: 16:00
End: 17:00
```

The final Event uses:

```text
16:00 → 17:00
```

The original extraction and the later edit should both remain part of the interaction history.

### 7.3 Reject

The user can reject the proposed Event.

```text
Reject
    ↓
Cancel Event creation
    ↓
Assistant displays a short cancellation message
```

No Event is created.

Example response:

```text
Event creation was cancelled.
```

---

## 8. Conversation Model

V1 uses one persistent conversation per user.

There is no conversation selector or multiple-chat model.

Conceptually:

```text
User
 └── Personal Assistant
      ├── User Message
      ├── Assistant Message
      ├── Event Card
      ├── Event Edit
      ├── Event Confirm
      └── Assistant Message
```

The conversation acts as one continuous interaction timeline.

---

## 9. Interaction History

A core V1 requirement is to preserve the complete interaction history.

The system must persist more than plain text messages.

It must also preserve structured interactions.

### 9.1 Text Interactions

- User Message
- Assistant Message

### 9.2 Event Interactions

- Event Card
- Event Edit
- Event Confirm
- Event Reject

Example interaction:

```text
User
"Meeting at Ericsson tomorrow at 3 PM"

↓

Assistant
Event Card

Start: 15:00
Location: Ericsson

↓

User
Edit

End: 16:00

↓

User
Confirm

↓

Assistant
Event created.
```

---

## 10. Replay Requirement

Refreshing the browser or reopening the application must not remove previous interactions.

The complete timeline must be reconstructable.

This includes:

```text
Messages
Cards
Edits
Confirmations
Rejections
```

For example, if the original Event Card contained:

```text
Start: 15:00
```

and the user later changed it to:

```text
Start: 16:00
```

the historical interaction should still show that the assistant originally suggested `15:00`.

The final Event should contain `16:00`.

---

## 11. Interaction History vs Business Data

V1 distinguishes two concepts.

### Interaction History

Describes:

> What happened between the user and the assistant?

Example:

```text
Assistant proposed 15:00.
User changed it to 16:00.
User confirmed the Event.
```

### Business Data

Describes:

> What Event was ultimately created?

Example:

```text
Final Event Start Time: 16:00
```

These two types of information should not be treated as the same thing.

---

## 12. Core Product Principle

> **Every visible interaction must be persisted and replayable.**

The system should preserve both:

```text
Interaction Process
+
Final Business Result
```

---

## 13. V1 Core Flow

```text
Natural-Language Input
        ↓
Intent Detection
        ↓
     Event?
     /    \
   No      Yes
   ↓        ↓
Text     Event Extraction
Response      ↓
          Event Card
              ↓
      Edit / Confirm / Reject
              ↓
        Confirmed Event
```

---

## 14. Out of Scope for V1

The following capabilities are intentionally excluded from V1:

- Memory
- Semantic Memory
- Episodic Memory
- RAG
- Document Upload
- Knowledge Base
- Vector Database
- Multi-Agent Collaboration
- Agent Supervisor
- Email generation and delivery
- Task Management
- Recurring Events
- Complex Reminder Rules
- Proactive Agent Actions
- Multiple Conversations

These capabilities may be introduced in later versions when actual product requirements justify them.

---

## 15. V1 Success Criteria

V1 is successful when a user can complete the following flow:

```text
Enter natural-language text
→ Receive an Event Card
→ Edit Event information
→ Confirm or Reject
→ Persist the interaction
→ Reopen the application
→ See the complete original interaction
```

The primary goal of V1 is not to create a complex autonomous agent.

The goal is to create a:

> **Simple, reliable, persistent, and replayable human-in-the-loop Event workflow.**
