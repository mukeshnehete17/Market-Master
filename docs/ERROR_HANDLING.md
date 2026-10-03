# Market Master — Error Handling Architecture

## 1. Error Response Standards
Every API error adheres to a consistent JSON structure accompanied by standard HTTP status codes:

```json
{
  "success": false,
  "message": "Human-readable error description.",
  "error": {
    "code": "SPECIFIC_ERROR_CODE",
    "details": {}
  }
}
```

---

## 2. Standardized Error Codes

| HTTP Status | Error Code | Trigger Condition | Client UX Guidance |
| :---: | :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Missing required fields, invalid email format, password too short, risk % out of bounds. | Display inline validation error message next to relevant field. |
| **401** | `UNAUTHORIZED` | Missing, expired, or invalid session token. | Redirect user to Login view; clear expired storage tokens. |
| **403** | `FORBIDDEN` | Authenticated user lacks required role (`admin`), or account is `disabled` / `banned`. | Show access denied message; do not permit navigation into admin desk. |
| **404** | `NOT_FOUND` | Specified Game ID, PIN, Question ID, or Round ID does not exist in Supabase. | Show resource not found banner; refresh list view to clear stale reference. |
| **409** | `CONFLICT` | Duplicate submission, game deletion attempted on active session, invalid state transition. | Inform user of state conflict; refresh to latest authoritative server state. |
| **500** | `INTERNAL_ERROR` | Unexpected backend exception during calculation. | Show retry button; log stack trace server-side with unique request ID. |
| **503** | `SERVICE_UNAVAILABLE` | Supabase connection dropped or query timed out. Raised via `DatabaseUnavailable`. | Show "Database temporarily unavailable. Please retry in a moment." banner. |

---

## 3. Critical Rules for Error Handling
1. **Never return HTTP 200 with hidden error**: Error states must always carry a 4xx or 5xx status code so fetch clients and monitoring tools catch them.
2. **Never return empty arrays on failure**: If a query fails, raise an exception or return an error status; never mask a database crash as `[]`.
3. **Never expose internal stack traces to client**: Error messages must be clean and sanitized; raw SQL or environment secrets must never appear in HTTP responses.
4. **No blank white screen on frontend**: Components must catch errors and display graceful error banners with retry triggers.
