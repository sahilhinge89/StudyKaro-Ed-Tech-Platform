// Central place to build the authentication cookie so every response that
// sets or clears it uses identical attributes.
//
// The frontend is served from the same origin as the API (NGINX proxies
// /api/ to the backend), so the cookie is issued by the same host the browser
// already trusts:
//
//   * httpOnly  -> the token is not readable from JavaScript (XSS safe)
//   * sameSite  -> "lax" works for same-origin requests and still survives
//                  top-level navigations coming back from payment providers
//   * secure    -> enabled whenever the request arrives over HTTPS
//   * path      -> "/" so the cookie is sent to every API route
//
// TRUST_PROXY lets Express read X-Forwarded-Proto from the NGINX/Ingress
// layer, otherwise `secure` cookies would never be set behind TLS.

const isProduction = process.env.NODE_ENV === "production";

// Cookie attributes can be forced through the environment, otherwise they are
// derived from the incoming request.
const secureCookieOverride = (() => {
	const raw = process.env.COOKIE_SECURE;
	if (raw === undefined || raw === "") return null;
	return raw === "true" || raw === "1";
})();

const sameSiteOverride = (() => {
	const raw = process.env.COOKIE_SAME_SITE;
	if (!raw) return null;
	const value = raw.toLowerCase();
	return value === "lax" || value === "strict" || value === "none" ? value : null;
})();

const buildCookieOptions = (req) => {
	const forwardedProto = req && req.headers ? req.headers["x-forwarded-proto"] : undefined;
	const isHttps =
		(forwardedProto ? String(forwardedProto).split(",")[0].trim() : "") === "https" ||
		(req && req.protocol === "https");

	// "SameSite=None" is meaningless (and rejected by browsers) without Secure.
	const sameSite = sameSiteOverride || "lax";
	let secure =
		secureCookieOverride !== null
			? secureCookieOverride
			: isHttps;

	// A "SameSite=None" cookie is only accepted by the browser when it is
	// also marked "Secure", so force it on regardless of the request scheme.
	if (sameSite === "none") {
		secure = true;
	}

	return {
		httpOnly: true,
		sameSite,
		secure,
		path: "/",
		maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days, matches the JWT lifetime
	};
};

const buildClearCookieOptions = (req) => {
	const { maxAge, ...options } = buildCookieOptions(req);
	return options;
};

module.exports = { buildCookieOptions, buildClearCookieOptions, isProduction };
