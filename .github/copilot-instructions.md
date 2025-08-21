<!-- AI Agent Operational Instructions (Concise) -->

## AI Agent Quick Guide (Read First)

Purpose: Implement & maintain a user management mini‑app (Vue 3 SPA + Vercel serverless Node.js + PostgreSQL/Prisma) with JWT auth (access + refresh), role RBAC (admin/user), soft delete, pagination/search/sort.

Big Picture

- Monorepo: `/api` (serverless functions) + `/web` (SPA). `vercel.json` routes non-/api requests to SPA index.
- Stateless backend; auth via short‑lived access token (header) + refresh token (httpOnly cookie) rotated on `/refresh`.
- Core entity: `User` (roles[], isActive). Optional `AuditLog` for bonus tracking.

Key Directories & Files

- `/api/lib/auth.ts`: hashing (argon2id), JWT sign/verify, cookie helpers. Extend here for new auth features.
- `/api/lib/prisma.ts`: singleton Prisma client (avoid per-invocation re‑creation).
- `/api/users/*.ts`: list & item handlers show pagination, search (case-insensitive contains), role checks, soft delete.
- `/api/login.ts` / `/api/refresh.ts`: credential validation & token rotation patterns.
- `/web/src/stores/auth.ts`: single Pinia store restoring token + setting Axios Authorization header.
- `/web/src/api/axios.ts`: response interceptor performing one refresh attempt on 401.
- `Project_Architecture_Blueprint.md`: extended rationale & diagrams.

Patterns & Conventions

- Handler flow: CORS setup → OPTIONS early return → auth (if needed) → parse/validate → business rule enforcement (self‑demotion, self‑deactivate guard) → DB via Prisma → uniform JSON response.
- Soft deletion: `isActive=false`; list queries must filter only when explicitly requested (current list returns both or filtered via `active` query param). Do not physically delete.
- Role logic: Only admins can create/update roles or deactivate; a user can only update their own name/password.
- Email: always lowercased before persistence; uniqueness enforced in DB.
- Pagination: `page>=1`, `size<=50`; compute `skip = (page-1)*size`.
- Search: OR on `name` + `email` with `contains` + `mode: 'insensitive'`.
- Sorting: `orderBy` on `name|email|createdAt`; default `createdAt desc`.

Security Expectations

- Never expose `password` hash; mask sensitive fields in logs.
- Refresh token ONLY via secure httpOnly cookie (`SameSite=Strict`).
- On adding new endpoints: require bearer auth unless explicitly public (only `/login` & `/refresh`).
- Add rate limiting hook (optional) in auth-related functions only.

Common Pitfalls to Avoid

- Creating a new PrismaClient per request (reuse provided singleton pattern).
- Allowing admin to remove own `admin` role or deactivate self (guard explicitly).
- Forgetting to rotate refresh token on `/refresh`.
- Storing refresh token in localStorage (must remain cookie-based).

Extending the System

- New user-derived calculations: create helper in `/api/lib/*` not in handlers directly.
- Additional filters: extend list handler query `where` object carefully; maintain existing indexes (consider adding index in migrations if sorting changes).
- Avatar upload (bonus): isolate storage adapter; validate mime & size before persisting & updating `avatarUrl`.

Testing (If Added)

- Unit: auth utils (hash/verify, sign/verify). Integration: login→refresh→CRUD path.
- E2E: front-end login & table interactions (Playwright).

When in Doubt

- Consult blueprint for architectural intent.
- Preserve existing authorization & soft delete invariants before introducing new features.

---

# Full‑Stack Mini App — Implementation Prompt (Vercel, PostgreSQL, Vue 3, Node Serverless)

## Goal

Build a mini web app for user management with authentication, roles, and a data table.

## Tech Decisions (Locked)

- Single GitHub repo with two workspaces: /web (Vue 3 app) and /api (Vercel Serverless Functions)
- Database: PostgreSQL (Vercel Postgres/Neon or external Postgres)
- Backend: Node.js serverless functions on Vercel, TypeScript, Prisma ORM
- Frontend: Vue 3 + Vite + Pinia + Vue Router; UI library: Naive UI (Tailwind optional)
- Auth: JWT access (15 min) + refresh (7 days) with rotation, refresh via httpOnly cookie
- Roles: admin (full CRUD) and user (read‑only + self update for name/password)
- User lifecycle: soft delete (isActive=false); prevent admin from self‑demotion or self‑deactivation
- Table: pagination (default size=10, max=50), search (case‑insensitive substring on name/email), sorting (name, email, createdAt)
- Security: argon2id password hashing; login rate limiting (Upstash Redis optional), strict CORS to frontend origin
- Bonus (optional): profile photo upload to Vercel Blob/S3; audit logs in Postgres; basic API and frontend tests
- CI/CD: Deploy on Vercel; optional GitHub Actions for lint/tests

## Scope

- Backend REST API endpoints: POST /login, POST /refresh, GET /users, POST /users, GET /users/{id}, PUT /users/{id}, DELETE /users/{id}, GET/PUT /me (self profile)
- Frontend SPA with login form, dashboard user table, create/edit form (modal or page), notifications for success/error
- Role‑based UI: admin sees full CRUD actions; user read‑only list plus self profile update

## Non‑Goals

- No CMS; no Laravel Breeze/Symfony EasyAdmin; no unrelated entities or complex RBAC beyond admin/user
- No advanced theming beyond Naive UI/Tailwind basics unless requested

## Data Model (Authoritative)

User fields:

- id (int, PK, autoincrement)
- name (string, ≤120)
- email (string, unique, stored lowercased, ≤180)
- password (string, argon2id hash)
- roles (array of strings; must contain "user" and optionally "admin")
- isActive (bool, default true)
- createdAt (datetime, default now)
- updatedAt (datetime, nullable)
- avatarUrl (string, optional)

AuditLog (optional bonus):

- id, actorId (nullable), action (string), entity (string, e.g., "User"), entityId (int, nullable), payload (JSON), createdAt

## API Contract (Behavioral)

General:

- All non‑auth endpoints require Authorization: Bearer <access_token>
- 401 for missing/invalid/expired access token; frontend should attempt a single refresh, then logout
- 403 for role violations; 404 for missing resources; 400 for validation errors

Auth:

- POST /login: body { email, password } → 200 returns { token, user } and sets httpOnly refresh cookie; 401 on invalid creds
- POST /refresh: uses refresh cookie; 200 returns new { token } and rotates refresh cookie; 401 on invalid/missing refresh

Users collection:

- GET /users: query params page (≥1), size (1..50, default 10), search (string), role ("user"|"admin"), active ("true"|"false"), sort (name|email|createdAt), dir (asc|desc)
  - Returns { items, page, size, total, totalPages }
- POST /users (admin only): body requires name, email; password optional (default safe temporary); roles defaults to ["user"]
  - Returns { id }

User item:

- GET /users/{id}: returns public fields (no password)
- PUT /users/{id}:
  - Admin may update name, roles, isActive
  - Non‑admin may only update own name
  - Prevent removing own admin role; prevent deactivating self
- DELETE /users/{id} (admin only): soft delete—sets isActive=false; cannot deactivate self

Me (profile):

- GET /me: returns current user’s profile
- PUT /me: allows changing own name and/or password (requires oldPassword + newPassword)

Validation:

- Email unique; password policy: min length 8; recommend complexity check
- Inputs trimmed; email lowercased; safe error messages (no user enumeration)

Rate limiting (optional):

- Apply to POST /login by IP and by email for short window to deter brute force

CORS:

- Allow only FRONTEND_ORIGIN; include headers: Content‑Type, Authorization; methods: GET, POST, PUT, DELETE, OPTIONS

## Frontend Behavior (UX Requirements)

- Login page with email/password; on success, store access token in memory (and optionally localStorage for session restore); refresh token remains in httpOnly cookie
- Dashboard users table: filters (role, active), global search, sortable columns (name/email/createdAt), client‑side pagination controls bound to API params
- Admin actions: add user, edit user (name/roles/isActive), soft delete; confirm dialogs where appropriate
- User role: read‑only list; can update own name/password under /me
- Notifications: success/error toasts; inline form errors from API validation
- Auth flow: auto‑logout and redirect to /login on expired/invalid tokens after one refresh attempt

## Environment & Config

- Environment variables (Vercel): DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL_SECONDS, JWT_REFRESH_TTL_SECONDS, FRONTEND_ORIGIN; optional BLOB/S3 and Upstash Redis variables
- Commit .env.example with required keys (no secrets)

## Repository Layout (High‑Level)

- /api: serverless functions, shared utils (auth, db, response), Prisma schema and migrations
- /web: Vue app (router, store, views, components), API client, auth store, UI components
- vercel.json routes: proxy /api/\* to functions; SPA fallback to web/dist/index.html

## Security Requirements

- Argon2id hashing; never store plaintext passwords
- Refresh tokens only in httpOnly secure cookies (SameSite=Strict); access token in Authorization header
- Email uniqueness enforced at DB level
- Avoid sensitive data in client storage beyond access token; rotate refresh tokens
- Redact sensitive fields from logs; configure logging levels per environment

## Acceptance Criteria (Backend)

- Login returns 200 with token for valid credentials; 401 for invalid
- Refresh rotates cookie and returns new token; invalid cookie → 401
- GET /users supports pagination, search (substring, case‑insensitive), sorting; returns correct totals
- Admin can create user; duplicate email → 409/400 with clear error
- Admin can update other users; cannot remove own admin role
- Admin can soft delete another user; cannot deactivate self
- Non‑admin cannot modify others; can update own name/password only

## Acceptance Criteria (Frontend)

- Login page authenticates and navigates to /users on success; invalid shows error message
- Users table binds filters/search/sort/pagination to API; UI updates reflect API results
- Role‑based UI: admin sees create/edit/delete controls; user does not
- Error states handled: token expiry triggers single refresh attempt, then logout and redirect to /login
- Notifications appear on success/error; form validation messages shown inline

## Bonus Acceptance (Optional)

- Avatar upload works (size limit, type checks); URL saved on user
- Minimal audit log rows created for user CRUD and login success/failure
- Basic tests pass in CI (API unit tests and/or Playwright for login→list)

## Deliverables

- One GitHub repository containing /api and /web
- Clear README with: install/run steps (local + Vercel), environment variables, tech stack, and screenshots if possible
- Deployed app on Vercel (bonus) with working auth and users table

## Definition of Done

- All acceptance criteria above pass
- README complete; environment variables documented; no secrets committed
- Lint passes; basic tests (if included) pass; Vercel deployment successful

## Notes/Constraints

- Avoid generated admin stacks (Breeze/EasyAdmin); implement base features manually
- Keep implementation minimal, readable, and secure by default

**If you need the full spec or diagrams, consult**: `/docs/Project_Architecture_Blueprint.md`.
When generating code, align with the blueprint’s patterns and file structure.
