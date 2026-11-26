// CORS configuration.
//
// The browser sends credentialed requests (the auth token lives in an
// httpOnly cookie), and the CORS spec forbids combining a wildcard origin
// with `Access-Control-Allow-Credentials: true`. Instead we resolve an
// explicit allow-list and echo back the single origin that matched.
//
// Allowed origins are configured with the CLIENT_ORIGINS environment variable
// as a comma separated list, e.g. "https://app.example.com,https://www.example.com".
// A value of "*" reflects the caller's Origin header (never the literal "*"),
// which keeps credentialed requests working while remaining explicit.

const parseOrigins = () =>
	(process.env.CLIENT_ORIGINS || "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

const allowedOrigins = parseOrigins();

// Requests without an Origin header (same-origin navigation, curl, kubelet
// probes, service-to-service calls) are always allowed.
const isOriginAllowed = (origin) => {
	if (!origin) return true;
	if (allowedOrigins.includes("*")) return true;
	return allowedOrigins.includes(origin);
};

const corsOptions = {
	origin(origin, callback) {
		if (isOriginAllowed(origin)) {
			// Echo the exact origin so credentialed requests are accepted.
			callback(null, origin || true);
		} else {
			callback(new Error(`CORS blocked for origin: ${origin}`));
		}
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
	exposedHeaders: ["Content-Disposition"],
	maxAge: 86400,
};

module.exports = { corsOptions, allowedOrigins, isOriginAllowed };
