# ADR-001: Target Repository Structure & Code Separation

## 1. Context & Problem
The repository historically developed organically with AI-assisted prototypes, leading to:
- Backend code nested inside `backend-source/Frontend + BackEnd/`.
- Frontend code nested inside `frontend-ui/FrontEnd/apps/web/`.
- An obsolete React prototype nested inside the backend (`backend-source/.../frontend`).
- Dead Jinja2 SSR template files (`templates/`, `static/`) mixed with REST API endpoints.
- Two separate virtual environments (`.venv` and `venv`).

## 2. Decision
1. Establish a canonical top-level architecture:
   - `/backend`: Python Flask API and test suites.
   - `/frontend`: React 19 + TypeScript + Vite SPA.
   - `/supabase`: SQL migrations and RLS policies.
   - `/docs`: Authoritative engineering documentation and ADRs.
2. Retire obsolete directories (`backend-source/.../frontend`, `templates/`, `static/`, `database/demo_*.py`) after verifying zero imports.
3. Update `vercel.json` and build scripts to point to the canonical paths.

## 3. Consequences
- **Positive**: Clean mental model, intuitive navigation, eliminates accidental edits to dead code, speeds up CI/CD builds.
- **Negative**: Requires careful path updates in deployment configs and virtual environment paths.
