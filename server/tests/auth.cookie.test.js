/**
 * Integration test for the cookie based authentication flow.
 *
 * It boots a real Express app that wires up the production CORS options, the
 * cookie parser, the real `auth` middleware and the real `logout` controller.
 * The database is never contacted: the middleware only verifies the JWT, and
 * the logout controller just clears the cookie.
 *
 * Run with: node server/tests/auth.cookie.test.js
 */

const assert = require("assert");
const path = require("path");

// Load the environment before the config modules read it.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-cookie-tests";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const { corsOptions } = require("../config/cors");
const { buildCookieOptions, buildClearCookieOptions } = require("../config/cookie");
const { auth } = require("../middleware/auth");
const { logout } = require("../controllers/Auth");

// Build the app exactly like server/index.js does.
const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.post("/api/v1/auth/logout", logout);
app.get("/api/v1/profile/getUserDetails", auth, (req, res) =>
	res.json({ success: true, data: { email: req.user.email } })
);

const server = app.listen(0);
const { port } = server.address();
const BASE = `http://127.0.0.1:${port}`;

let passed = 0;
const failures = [];

const check = (name, fn) => {
	try {
		fn();
		passed += 1;
		console.log(`  ok   ${name}`);
	} catch (error) {
		failures.push({ name, error });
		console.log(`  FAIL ${name}: ${error.message}`);
	}
};

const request = (url, options = {}) =>
	fetch(`${BASE}${url}`, { redirect: "manual", ...options });

const run = async () => {
	console.log("cookie auth integration tests");

	// ---------------------------------------------------------------------
	// 1. The auth middleware accepts the token from the cookie.
	// ---------------------------------------------------------------------
	const token = jwt.sign(
		{ email: "student@example.com", id: "507f1f77bcf86cd799439011", role: "Student" },
		process.env.JWT_SECRET,
		{ expiresIn: "24h" }
	);

	const cookieHeader = `token=${token}`;

	const okRes = await request("/api/v1/profile/getUserDetails", {
		headers: { Cookie: cookieHeader },
	});
	const okBody = await okRes.json();
	check("cookie is accepted by the auth middleware", () => {
		assert.strictEqual(okRes.status, 200);
		assert.strictEqual(okBody.success, true);
		assert.strictEqual(okBody.data.email, "student@example.com");
	});

	// ---------------------------------------------------------------------
	// 2. A request without any token is rejected with 401 (and does not
	//    crash on a missing Authorization header).
	// ---------------------------------------------------------------------
	const noTokenRes = await request("/api/v1/profile/getUserDetails");
	check("missing token returns 401 instead of throwing", () => {
		assert.strictEqual(noTokenRes.status, 401);
	});

	// ---------------------------------------------------------------------
	// 3. The Bearer header still works for non-browser API clients.
	// ---------------------------------------------------------------------
	const bearerRes = await request("/api/v1/profile/getUserDetails", {
		headers: { Authorization: `Bearer ${token}` },
	});
	check("bearer token still works for API clients", () => {
		assert.strictEqual(bearerRes.status, 200);
	});


	// ---------------------------------------------------------------------
	// 4. Logout clears the cookie.
	// ---------------------------------------------------------------------
	const logoutRes = await request("/api/v1/auth/logout", { method: "POST" });
	const setCookie = logoutRes.headers.get("set-cookie") || "";
	check("logout clears the token cookie", () => {
		assert.strictEqual(logoutRes.status, 200);
		assert.ok(/token=/.test(setCookie), "expected a token cookie to be cleared");
		assert.ok(
			/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(setCookie),
			"expected the cookie to expire immediately"
		);
	});

	// ---------------------------------------------------------------------
	// 5. The cookie attributes are hardened.
	// ---------------------------------------------------------------------
	check("cookie options are hardened", () => {
		const options = buildCookieOptions({
			headers: { "x-forwarded-proto": "https" },
			protocol: "http",
		});
		assert.strictEqual(options.httpOnly, true, "cookie must be httpOnly");
		assert.strictEqual(options.path, "/", "cookie must be scoped to /");
		assert.strictEqual(options.sameSite, "lax", "cookie must default to SameSite=Lax");
		assert.strictEqual(
			options.secure,
			true,
			"a https request behind a proxy must produce a secure cookie"
		);
		assert.ok(options.maxAge > 0, "cookie must have a lifetime");
	});

	// ---------------------------------------------------------------------
	// 6. SameSite=None always forces Secure.
	// ---------------------------------------------------------------------
	check("SameSite=None forces Secure", () => {
		const previous = process.env.COOKIE_SAME_SITE;
		const previousSecure = process.env.COOKIE_SECURE;
		process.env.COOKIE_SAME_SITE = "none";
		process.env.COOKIE_SECURE = "false";
		delete require.cache[require.resolve("../config/cookie")];
		const reloaded = require("../config/cookie");
		const options = reloaded.buildCookieOptions({ headers: {}, protocol: "http" });
		assert.strictEqual(options.sameSite, "none");
		assert.strictEqual(options.secure, true, "SameSite=None must always be Secure");
		if (previous === undefined) delete process.env.COOKIE_SAME_SITE;
		else process.env.COOKIE_SAME_SITE = previous;
		if (previousSecure === undefined) delete process.env.COOKIE_SECURE;
		else process.env.COOKIE_SECURE = previousSecure;
		delete require.cache[require.resolve("../config/cookie")];
	});

	// ---------------------------------------------------------------------
	// 7. CORS: a disallowed origin is rejected, an allowed one is echoed.
	// ---------------------------------------------------------------------
	process.env.CLIENT_ORIGINS = "https://app.example.com";
	delete require.cache[require.resolve("../config/cors")];
	const reloadedCors = require("../config/cors");

	check("CORS allow-list behaviour", () => {
		assert.strictEqual(
			reloadedCors.isOriginAllowed("https://app.example.com"),
			true,
			"the configured origin must be allowed"
		);
		assert.strictEqual(
			reloadedCors.isOriginAllowed("https://evil.example.com"),
			false,
			"an unknown origin must be blocked"
		);
		assert.strictEqual(
			reloadedCors.isOriginAllowed(undefined),
			true,
			"requests without Origin must be allowed"
		);
	});

	// The real server uses the reloaded options for the actual CORS headers.
	const corsApp = express();
	corsApp.use(cors(reloadedCors.corsOptions));
	const corsServer = corsApp.listen(0);
	const corsBase = `http://127.0.0.1:${corsServer.address().port}`;
	const allowedRes = await fetch(`${corsBase}/`, {
		headers: { Origin: "https://app.example.com" },
	});
	const allowedHeader = allowedRes.headers.get("access-control-allow-origin");
	const credsHeader = allowedRes.headers.get("access-control-allow-credentials");
	check("CORS echoes the allowed origin and allows credentials", () => {
		assert.strictEqual(allowedHeader, "https://app.example.com");
		assert.strictEqual(credsHeader, "true");
	});
	await new Promise((resolve) => corsServer.close(resolve));

	// ---------------------------------------------------------------------
	// 8. The clear-cookie options must match the set-cookie options
	//    (otherwise the browser keeps the cookie).
	// ---------------------------------------------------------------------
	check("clear-cookie options match the set-cookie options", () => {
		const set = buildCookieOptions({ headers: {}, protocol: "https" });
		const clear = buildClearCookieOptions({ headers: {}, protocol: "https" });
		assert.strictEqual(clear.path, set.path);
		assert.strictEqual(clear.httpOnly, set.httpOnly);
		assert.strictEqual(clear.sameSite, set.sameSite);
		assert.strictEqual(clear.secure, set.secure);
		assert.ok(!("maxAge" in clear), "the clear options must not set a maxAge");
	});

	console.log(`
${passed} passed, ${failures.length} failed`);
	server.close();
	process.exit(failures.length === 0 ? 0 : 1);
};

run().catch((error) => {
	console.error("test run crashed:", error);
	server.close();
	process.exit(1);
});
