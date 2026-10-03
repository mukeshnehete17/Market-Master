# ADR-002: Dual Authentication (Bearer Token & Session Cookies)

## 1. Context & Problem
Frontend clients operate in heterogeneous environments: web browsers, mobile browsers, and automated QA scripts. Relying exclusively on HTTP-only cookies can create cross-origin friction during local development and testing, while relying exclusively on `localStorage` tokens leaves browser sessions vulnerable to XSS token theft.

## 2. Decision
Implement a unified dual-mode authentication scheme:
1. `POST /api/auth/login` and `signup` return both a JWT Bearer token and set an `HttpOnly; SameSite=Lax` session cookie.
2. The server-side identity resolver (`engine.current_identity()`) first checks the `Authorization: Bearer <token>` header; if absent, it checks the encrypted Flask session cookie.
3. Protected endpoints enforce identical authorization checks regardless of token origin.

## 3. Consequences
- **Positive**: Seamless local testing, rock-solid automated pytest integration, and zero cross-origin breakage.
- **Negative**: Server must handle both token validation mechanisms in the identity resolver.
