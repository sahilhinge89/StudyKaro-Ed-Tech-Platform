// Importing necessary modules and packages
const express = require("express");
const app = express();
const userRoutes = require("./routes/user");
const profileRoutes = require("./routes/profile");
const courseRoutes = require("./routes/Course");
const paymentRoutes = require("./routes/Payments");
const contactUsRoute = require("./routes/Contact");
const database = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { cloudinaryConnect } = require("./config/cloudinary");
const fileUpload = require("express-fileupload");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { corsOptions } = require("./config/cors");

// Setting up port number
const PORT = process.env.PORT || 4000;

// Loading environment variables from .env file
dotenv.config();

// Behind NGINX / a Kubernetes Ingress the client IP and the original protocol
// arrive in X-Forwarded-* headers. Trusting the proxy is required for
// `secure` cookies and for correct client IPs in the logs.
if (process.env.TRUST_PROXY !== "false") {
	app.set("trust proxy", process.env.TRUST_PROXY || 1);
}

// Do not advertise the server technology
app.disable("x-powered-by");

// Connecting to database
database.connect();

// Middlewares
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());
app.use(cors(corsOptions));
// Answer pre-flight requests before any route handler runs
app.options(/.*/, cors(corsOptions));
app.use(
	fileUpload({
		useTempFiles: true,
		tempFileDir: "/tmp/",
	})
);

// Baseline security headers for the API responses
app.use((req, res, next) => {
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("X-Frame-Options", "SAMEORIGIN");
	res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
	next();
});

// Connecting to cloudinary
cloudinaryConnect();

// Setting up routes
app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/course", courseRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/reach", contactUsRoute);

// Liveness probe: the process is up and serving requests.
// Kept free of any database call so a slow database cannot cause a restart.
app.get("/healthz", (req, res) => {
	return res.status(200).json({
		success: true,
		status: "ok",
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	});
});

// Readiness probe: the process is up *and* the database connection is usable.
// Kubernetes only routes traffic to this pod once this returns 200.
app.get("/readyz", (req, res) => {
	// 1 === mongoose connected
	const dbReady = mongoose.connection.readyState === 1;

	return res.status(dbReady ? 200 : 503).json({
		success: dbReady,
		status: dbReady ? "ready" : "not-ready",
		database: dbReady ? "connected" : "disconnected",
		timestamp: new Date().toISOString(),
	});
});

// Testing the server
app.get("/", (req, res) => {
	return res.json({
		success: true,
		message: "Your server is up and running ...",
	});
});

// Listening to the server
const server = app.listen(PORT, () => {
	console.log(`App is listening at ${PORT}`);
});

// Graceful shutdown so in-flight requests finish and the pod terminates cleanly
const shutdown = (signal) => {
	console.log(`${signal} received, shutting down gracefully...`);
	server.close(() => {
		mongoose.connection.close(false).then(
			() => process.exit(0),
			() => process.exit(1)
		);
	});
	// Force exit if the connections do not drain in time
	setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// End of code.
