# Market Master — Deployment Architecture

## 1. Production Topology & Routing

```
[Student / Admin Browsers]
           │
           │ HTTPS Traffic
           ▼
[Edge Router / Vercel Ingress]
   │
   ├─ Path: `/api/(.*)`  ──> Routes to Flask Backend Service (`app:app`)
   │                               │
   │                               │ PostgREST over HTTPS (TLS 1.3)
   │                               ▼
   │                    [Supabase Managed PostgreSQL]
   │
   └─ Path: `/(.*)`      ──> Serves Static SPA Assets (Vite React Build: HTML, JS, CSS)
```

---

## 2. Configuration & Ingress (`vercel.json`)
The production root ingress routes all API calls to the Python backend while serving the React SPA bundle:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "frontend": {
      "root": "frontend-ui/FrontEnd/apps/web",
      "framework": "vite"
    },
    "backend": {
      "root": "backend-source/Frontend + BackEnd",
      "framework": "flask",
      "entrypoint": "app:app"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "backend" } },
    { "source": "/api", "destination": { "service": "backend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ]
}
```

---

## 3. Health Checks & Verification Endpoints
- **Liveness**: `GET /api/health` returns HTTP 200 `{"status": "ok", "service": "market-master-api"}`.
- **Readiness (Database connectivity)**: `GET /api/health/db` tests real Supabase reachability and returns HTTP 200 `{"status": "healthy", "database": "connected"}`.
- **Deployment Verification Command**:
  ```bash
  curl -fsS https://<deployment-domain>/api/health/db
  ```
