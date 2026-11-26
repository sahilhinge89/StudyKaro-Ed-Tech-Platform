# StudyKaro — Production Hardening Summary

## Overview
Hardened StudyKaro’s frontend, backend authentication/CORS, Docker/NGINX, and Kubernetes configuration for production deployment.

## Completed Work

### 1. Backend Authentication → httpOnly Cookies

**`server/config/cookie.js`** — Centralized cookie attribute builder:
- `httpOnly: true`, `path: "/"`, `sameSite: "lax"` (default), `maxAge: 3 days` (matches JWT lifetime)
- `secure` derived from request protocol (`X-Forwarded-Proto` or `req.protocol`) — works behind NGINX/Ingress TLS termination
- `COOKIE_SECURE` and `COOKIE_SAME_SITE` environment overrides supported
- `SameSite=None` always forces `Secure` (browser requirement)
- `buildClearCookieOptions()` strips `maxAge` for clean cookie clearing

**`server/controllers/Auth.js`**:
- `login` sets the JWT via `res.cookie("token", buildCookieOptions(req))` instead of returning `token` in the JSON body
- Added `logout` controller calling `res.clearCookie("token", buildClearCookieOptions(req))`

**`server/middleware/auth.js`**:
- Cookie is the primary token source; `Authorization: Bearer` kept as fallback for API clients
- Fixed crash on missing `Authorization` header (was calling `.replace()` on `undefined`)

**`server/routes/user.js`** — Added `POST /auth/logout` route.

### 2. Backend Hardening (`server/index.js`)
- `TRUST_PROXY` support — reads `X-Forwarded-Proto` from NGINX/Ingress for correct `secure` cookies
- `app.disable("x-powered-by")` — hides server technology
- Baseline security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`
- `app.options(/.*/, cors(corsOptions))` — pre-flight handled before routes
- **`/healthz`** — liveness probe (no DB call)
- **`/readyz`** — readiness probe (checks `mongoose.readyState === 1`, returns 503 if DB disconnected)
- Graceful shutdown on `SIGTERM`/`SIGINT`

### 3. Frontend → Cookie-Based Auth (no localStorage tokens)

**`src/services/apiConnector.js`** — `withCredentials: true` so httpOnly cookies are sent; strips any `Authorization` headers

**`src/services/operations/authAPI.js`**:
- Login: `dispatch(setToken(true))` — token no longer stored in Redux or localStorage
- Logout: calls `POST /auth/logout` to clear the cookie on the backend

**`src/services/apis.js`** — Same-origin base URL `/api/v1` (default); `REACT_APP_BASE_URL` can override; added `LOGOUT_API` endpoint

**`src/App.jsx`** — Session restored via cookie-backed `getUserDetails(null, navigate, true)` instead of reading `localStorage`

**`src/services/operations/profileAPI.js`** — Removed all `Authorization: Bearer ${token}` headers; added `silent` mode for session restore

**`src/services/operations/SettingsAPI.js`, `courseDetailsAPI.js`, `studentFeaturesAPI.js`** — Removed all `Authorization` headers

**`src/components/core/Dashboard/AddCourse/CourseBuilder/NestedView.jsx`** — Removed unused `token` selector

Result: Zero `localStorage` token usage; zero `Bearer` headers in frontend source.

### 4. CORS (`server/config/cors.js`)
- Explicit `CLIENT_ORIGINS` allowlist (no literal wildcard origin)
- Credential support, echoed origin for credentialed requests
- Same-origin requests (no Origin header) always allowed

### 5. Docker / NGINX / Kubernetes

**Dockerfiles**:
- `Dockerfile.backend` — healthcheck uses `/healthz`
- `Dockerfile.frontend` — copies `security-headers.conf`
- `Dockerfiles/nginx.conf` — `server_tokens off`, same-origin `/api/` proxy with `X-Forwarded-Proto`, security headers via included snippet
- `Dockerfiles/security-headers.conf` — NEW: CSP, `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, `Permissions-Policy`, `HSTS`

**Kubernetes** (`K8s/Deployment.yaml`):
- Backend probes: `/healthz` (liveness), `/readyz` (readiness with DB check)
- Frontend probes: `/healthz` (startup, liveness, readiness)
- ConfigMap: `TRUST_PROXY=1`, `CLIENT_ORIGINS=REPLACE_ME`, `COOKIE_SAME_SITE=lax`, `COOKIE_SECURE=true`
- All containers: non-root, read-only rootfs, dropped capabilities, no privilege escalation

**Environment examples**:
- `server/.env.example` — added `CLIENT_ORIGINS`, `TRUST_PROXY`, `COOKIE_SAME_SITE`, `COOKIE_SECURE`
- `.env.example` (NEW) — frontend: `REACT_APP_BASE_URL`, `REACT_APP_RAZORPAY_KEY`

### 6. Integration Test (`server/tests/auth.cookie.test.js`)
9 tests covering: cookie acceptance, 401 on missing token, Bearer fallback, logout clears cookie, cookie attributes (httpOnly/path/sameSite/secure/maxAge), SameSite=None→Secure, CORS allow-list behavior, CORS header echo + credentials, clear-cookie option parity.
- **Result: 9 passed, 0 failed**

## Validation Results

| Check | Result |
|-------|--------|
| ESLint (`src --ext .js,.jsx`) | ✅ Passed (clean) |
| Frontend build (`CI=true npm run build`) | ✅ Passed |
| `.lint_scan.py` | ✅ 0 unused imports |
| `.k8s_validate.py` | ✅ RESULT: OK |
| Backend syntax (`node --check`) | ✅ All files OK |
| Cookie auth integration test | ✅ 9 passed, 0 failed |

## Remaining Item

**Production origin for CORS**: `CLIENT_ORIGINS` is set to `REPLACE_ME` in both `K8s/Deployment.yaml` and `server/.env.example`. Replace this with your actual production frontend origin(s) before deploying (e.g. `https://studykaro.example.com`).
