# StudyKaro Changelog

## [Unreleased] — Production Hardening

### Security

- **Authentication migrated from `localStorage` + `Authorization: Bearer` to httpOnly cookies**
  - The JWT is now set by the backend via `Set-Cookie` with `httpOnly`, `SameSite=Lax`, `Secure`, `path="/"`, and a 3-day max-age, so the token is never readable by JavaScript (XSS-safe).
  - Frontend `apiConnector` now sends `withCredentials: true` and strips any `Authorization` headers, guaranteeing the JWT is never exposed to browser scripts.
  - Removed all `localStorage.setItem("token", …)` / `localStorage.removeItem("token")` calls and removed `localStorage.getItem("token")` rehydration from `authSlice` and `App.jsx`.
  - Added `POST /auth/logout` endpoint that clears the httpOnly cookie; frontend logout calls this endpoint before clearing local Redux state.

- **Hardened CORS configuration** (`server/config/cors.js`)
  - Replaced `origin: "*"` with an explicit `CLIENT_ORIGINS` allowlist (comma-separated via env var).
  - Credentialed requests echo the matched origin; no literal wildcard origin is ever sent.
  - Same-origin / no-Origin requests (curl, kubelet probes) remain allowed.
  - Pre-flight (`OPTIONS`) handled before route handlers.

- **Centralized cookie attributes** (`server/config/cookie.js`)
  - `buildCookieOptions(req)` / `buildClearCookieOptions(req)` used consistently for every set/clear of the `token` cookie.
  - `secure` derived from `X-Forwarded-Proto` / `req.protocol` so cookies work correctly behind NGINX / Ingress TLS termination.
  - `COOKIE_SECURE` and `COOKIE_SAME_SITE` environment overrides supported.
  - `SameSite=None` always forces `Secure` (browser requirement).

- **Backend request hardening** (`server/index.js`)
  - `TRUST_PROXY` support so Express reads the real client IP and protocol from `X-Forwarded-*` headers.
  - `app.disable("x-powered-by")` removes the Express fingerprint header.
  - Baseline security headers on all API responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - Request body limits (5 MB) on JSON and urlencoded parsers.

- **Auth middleware robustness** (`server/middleware/auth.js`)
  - Fixed a crash when the `Authorization` header was absent (`req.header("Authorization").replace(...)` on `undefined`).
  - Cookie is now the primary token source; `Authorization: Bearer` retained as a fallback for non-browser API clients.

### Observability / Operations

- **Added backend health endpoints**
  - `GET /healthz` — liveness probe (no database dependency, so a slow DB cannot trigger restarts).
  - `GET /readyz` — readiness probe (checks `mongoose.readyState === 1`; returns 503 when the DB is disconnected).
  - Both return structured JSON with timestamps.

- **Graceful shutdown** — `SIGTERM` / `SIGINT` close the HTTP server, close the Mongoose connection, and force-exit after a 10 s drain timeout.

- **NGINX frontend container**
  - `server_tokens off` to hide the NGINX version.
  - Same-origin `/api/` proxy to the backend with `X-Forwarded-Proto` preserved (critical for `Secure` cookies behind TLS termination).
  - Security headers snippet (`Dockerfiles/security-headers.conf`): CSP, `nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`.
  - Healthcheck uses `/healthz`.

- **Kubernetes manifests** (`K8s/Deployment.yaml`, `K8s/Service.yaml`)
  - Backend probes: `/healthz` (liveness), `/readyz` (readiness with DB check).
  - Frontend probes: `/healthz` (startup, liveness, readiness).
  - All containers run as non-root with read-only root filesystems, dropped capabilities, and no privilege escalation.
  - ConfigMap added: `TRUST_PROXY`, `CLIENT_ORIGINS`, `COOKIE_SAME_SITE`, `COOKIE_SECURE`.

### Developer Experience

- **New `.env.example` (frontend)** — documents `REACT_APP_BASE_URL` (default `/api/v1`) and `REACT_APP_RAZORPAY_KEY`.
- **Updated `server/.env.example`** — documents `CLIENT_ORIGINS`, `TRUST_PROXY`, `COOKIE_SAME_SITE`, `COOKIE_SECURE`.
- **New integration test** `server/tests/auth.cookie.test.js` — 9 tests covering cookie acceptance, 401 on missing token, Bearer fallback, logout cookie clearing, cookie attributes, `SameSite=None` → `Secure`, CORS allow-list behavior, and clear-cookie option parity.

### Remaining before production deploy

- Replace `CLIENT_ORIGINS=REPLACE_ME` in `K8s/Deployment.yaml` and `server/.env.example` with your actual production frontend origin(s), e.g. `https://studykaro.example.com`.

### Validation

| Check | Result |
|-------|--------|
| ESLint (`src --ext .js,.jsx`) | ✅ Passed |
| Frontend build (`CI=true npm run build`) | ✅ Passed |
| `.lint_scan.py` | ✅ 0 unused imports |
| `.k8s_validate.py` | ✅ OK |
| Backend syntax (`node --check`) | ✅ All files OK |
| Cookie auth integration test | ✅ 9 passed, 0 failed |
