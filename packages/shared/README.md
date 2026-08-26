# @life-inbox/shared

Framework-independent contracts shared by the LifeInbox API and web app.

## API envelope

Every JSON response uses exactly three fields:

```ts
ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope
```

Successful responses use `code: 0`, `message: "success"`, and place the endpoint
response in `data`. Error responses keep the meaningful HTTP status, use a stable
numeric `ApiErrorCode`, set `data` to `null`, and expose only a safe message.

The request ID is transported in the `x-request-id` response header rather than
adding a fourth envelope field.

## Error-code ranges

- `1000-1999`: common HTTP and request errors;
- `2000-8999`: reserved for approved feature or external-service errors;
- `9000-9999`: unexpected internal errors.

Codes are public contracts. Do not renumber or reuse an existing code for a new
meaning. Add feature-specific codes only when a client must handle the condition
differently.
