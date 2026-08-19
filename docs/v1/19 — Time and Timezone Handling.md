# 19 — Time and Timezone Handling

## 1. Goal

Event time handling must be predictable.

V1 stores:

```text
start_at
end_at
timezone
```

where:

- `start_at` is required
- `end_at` is optional
- `timezone` is required

---

## 2. Default Timezone

The default timezone comes from the user.

Example:

```text
Europe/Stockholm
```

The browser can detect the current timezone using:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone;
```

The backend remains responsible for deciding the final effective timezone.

---

## 3. Explicit Timezone Overrides Default

Example:

```text
Meeting tomorrow at 3 PM
```

with user timezone:

```text
Europe/Stockholm
```

uses:

```text
Europe/Stockholm
```

But:

```text
Meeting tomorrow at 3 PM London time
```

should use the explicitly stated timezone.

Priority:

```text
Explicit timezone
      ↓
User default timezone
```

---

## 4. Relative Time

The LLM may interpret expressions such as:

```text
tomorrow at 3 PM
this Friday at 10
next Monday afternoon
```

The backend must provide runtime context:

```text
Current date/time
User timezone
```

Example:

```text
Current time:
2026-08-19T15:56:00+02:00

Timezone:
Europe/Stockholm
```

The LLM should not guess the current date.

---

## 5. Event Draft Time

An Event Draft may contain:

```text
start_at = 2026-08-20T15:00:00
timezone = Europe/Stockholm
```

This represents:

> August 20, 2026 at 15:00 in Stockholm time.

If there is no duration:

```text
end_at = null
```

---

## 6. Confirmation

Before Event confirmation, the backend validates:

```text
start_at exists
timezone exists
```

If `end_at` exists:

```text
end_at > start_at
```

The backend should also validate that the timezone is supported.

---

## 7. Daylight Saving Time

Use IANA timezone identifiers instead of fixed UTC offsets.

Good:

```text
Europe/Stockholm
```

Avoid:

```text
UTC+1
UTC+2
```

because Stockholm may use different offsets depending on daylight-saving rules.

---

## 8. Display

The frontend should always display the Event timezone.

Example:

```text
Start
Aug 20, 2026 15:00

Timezone
Europe/Stockholm
```

This allows the user to detect timezone mistakes before confirmation.

---

## 9. LLM Responsibility

The LLM may determine:

```text
"tomorrow at 3 PM"
→ 2026-08-20T15:00:00
```

based on the runtime context provided by NestJS.

The LLM should not own:

- timezone validation
- DST rules
- `end_at > start_at`
- final business validation

---

## 10. Core Principle

> **The LLM interprets human time expressions; application code validates and normalizes time.**

This keeps time behavior deterministic while still allowing natural-language input.
