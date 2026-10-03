# ADR-007: Vercel Edge Ingress Routing & Backend Serverless Integration

## 1. Context & Problem
Market Master requires seamless single-domain deployment without CORS overhead or complex manual reverse-proxy configuration.

## 2. Decision
1. Deploy as a unified Vercel project using `vercel.json` edge rewrites:
   - All `/api/(.*)` requests route directly to the Flask backend service.
   - All other routes `/(.*)` serve the Vite React SPA static bundle.
2. In production, `getApiBaseUrl()` defaults to `""` (same-origin relative paths), completely eliminating cross-origin preflight requests (OPTIONS) and CORS latency.
3. Health check endpoints (`/api/health` and `/api/health/db`) provide automated ingress monitoring.

## 3. Consequences
- **Positive**: Zero CORS configuration needed in production, instant edge delivery of static assets, unified domain certificate.
- **Negative**: Bound to Vercel's serverless function timeout constraints (handled by keeping all database queries well under 250ms).
