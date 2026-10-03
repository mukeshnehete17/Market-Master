# Market Master — Environment Configuration

## 1. Secrets & Variable Isolation Policy
Variables are strictly segmented into three permission domains:

```
+-------------------------------------------------------------+
| BACKEND PRIVATE SECRETS (Python runtime only via os.environ)  |
| - SUPABASE_URL                                              |
| - SUPABASE_SERVICE_ROLE_KEY                                 |
| - SECRET_KEY                                                |
| - FLASK_ENV                                                 |
| ❌ MUST NEVER APPEAR IN FRONTEND CODE OR VITE CONFIG         |
+-------------------------------------------------------------+
| FRONTEND PUBLIC CLIENT VARIABLES (Exposed to browser via JS) |
| - VITE_API_BASE_URL (Empty in production; localhost in dev) |
+-------------------------------------------------------------+
```

---

## 2. Environment Matrix

| Variable Name | Required By | Environment | Sensitivity Level | Description / Canonical Example |
| :--- | :--- | :--- | :---: | :--- |
| `SUPABASE_URL` | Backend | Dev, Test, Prod | **High** | HTTPS URL of Supabase project (`https://<id>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Dev, Test, Prod | **Critical** | Service-role JWT bypassing RLS for backend database operations |
| `SECRET_KEY` | Backend | Dev, Test, Prod | **High** | Cryptographic key used to sign Flask session cookies |
| `JWT_SECRET` | Backend | Dev, Test, Prod | **High** | Cryptographic key used to sign and verify user JWT bearer tokens |
| `FLASK_ENV` | Backend | Dev, Test, Prod | Low | `production` or `development` |
| `PORT` | Backend | Prod | Low | Port assigned by runtime (default: 5000) |
| `VITE_API_BASE_URL` | Frontend | Dev | Public | `http://127.0.0.1:5000` (local development only) |
| `VITE_API_BASE_URL` | Frontend | Prod | Public | `""` (Empty string if same-origin; or backend domain if deployed separately) |

---

## 3. Local Development Setup
- **Backend**: Copy `backend-source/Frontend + BackEnd/.env.example` to `.env` and supply valid Supabase credentials.
- **Frontend**: The React client defaults to `http://127.0.0.1:5000` automatically during Vite dev server execution.
