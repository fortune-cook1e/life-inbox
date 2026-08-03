# LifeInbox

LifeInbox is a personal assistant that turns everyday messages into actions a user can review and
approve. The user talks to one assistant instead of filling in forms or managing internal records.

## Product direction

The assistant follows a small interaction pattern:

```text
User describes something
-> Agent understands the request
-> Agent asks for missing information
-> Agent shows a structured preview
-> User confirms the result
-> LifeInbox performs the approved action
```

Calendar events are the first capability. They provide a concrete starting point for dates, time
zones, clarification, confirmation, and external actions. LifeInbox can add other personal-assistant
capabilities after the Calendar Assistant is useful end to end.

## Product experience

Chat is the main interface. A user can start a new matter, answer a question, review a proposal, or
ask about an existing plan in the same conversation.

LifeInbox keeps each matter separate behind the scenes. Users do not need to create, select, or
switch internal Cases. The assistant must not reuse facts from one matter in another.

Structured previews create the boundary between conversation and action. A model response is a
proposal. The user must confirm the exact result before it becomes authoritative or causes an
external action.

Confirmed information should remain easy to find outside the chat. An Events view will show
confirmed calendar items without exposing internal Agent or Case state.

## Product principles

- Keep one assistant as the main entry point.
- Ask only for information that affects the result.
- Show what the assistant understood before taking action.
- Keep unrelated matters and their evidence separate.
- Require explicit approval for external actions.
- Add capabilities in response to real personal needs.
- Generalize only after two capabilities prove that they share the same concept.

## Capabilities

- [Calendar Assistant](features/calendar-assistant.md)

Each capability has one technical document. Slice briefs stay in the development conversation, and
feature documents keep only durable implementation decisions, failures, and proof.

## Active implementation plans

- [Calendar clarification continuation](plans/calendar-clarification-continuation.md)

An active plan is an approved implementation handoff, not a statement that the capability already
exists. After implementation is verified, durable behavior and proof move into the capability's
feature document.
