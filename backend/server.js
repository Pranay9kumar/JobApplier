require('dotenv').config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const meRoutes = require("./routes/me");
const aiRoutes = require("./routes/ai");
const jobsRoutes = require("./routes/jobs");
const resumeRoutes = require("./routes/resume");
const analyticsRoutes = require("./routes/analytics");
const {
	errorHandler,
	requestIdMiddleware,
	requestLoggingMiddleware,
	setupGracefulShutdown,
	asyncHandler,
} = require("./utils/errorHandler");
const {
	secureHeaders,
	createRateLimiter,
	aiRateLimiter,
} = require("./utils/securityMiddleware");

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

// Validate required environment variables
if (!MONGO_URI) {
	console.error("[STARTUP] FATAL: MONGO_URI not configured!");
	console.error("[STARTUP] Set MONGO_URI in .env file");
	process.exit(1);
}

async function start() {
	console.log("[STARTUP] Connecting to MongoDB...");
	await mongoose.connect(MONGO_URI);
	console.log("[STARTUP] MongoDB connected successfully");

	const app = express();

	// Middleware: Request ID and logging (must be early)
	app.use(requestIdMiddleware);
	app.use(requestLoggingMiddleware);

	// Security middleware
	app.use(secureHeaders);
	app.use(createRateLimiter(60000, 200)); // 200 requests per minute per IP

	// CORS configuration for production
	const allowedOrigins = process.env.ALLOWED_ORIGINS
		? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
		: ['http://localhost:3000', 'chrome-extension://localhost'];
	
	app.use(cors({
		origin: function (origin, callback) {
			// Allow requests with no origin (mobile apps, Postman, etc.)
			if (!origin) return callback(null, true);
			
			if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
				callback(null, true);
			} else {
				callback(new Error('Not allowed by CORS'));
			}
		},
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization']
	}));
	app.use(express.json());

	// Health check (no rate limit)
	app.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

	// Routes with rate limiting for AI endpoints
	app.use("/api/auth", createRateLimiter(60000, 50), authRoutes); // 50/min for auth
	app.use("/api", meRoutes);
	app.use("/api", resumeRoutes); // Resume endpoints
	app.use("/api/ai", aiRateLimiter, aiRoutes); // Custom AI rate limiting
	app.use("/api/analytics", analyticsRoutes); // Analytics with auth middleware
	app.use("/api", jobsRoutes);

	// 404 handler (must be before error handler)
	app.use((_req, res) => {
		res.status(404).json({
			success: false,
			error: {
				message: "Endpoint not found",
				code: "NOT_FOUND",
				requestId: _req.id,
				timestamp: new Date().toISOString(),
			},
		});
	});

	// Global error handler (must be last middleware)
	app.use(errorHandler);

	// Start server
	const server = app.listen(PORT, () => {
		console.log(`[SERVER] ✓ API listening on port ${PORT}`);
		console.log(`[SERVER] ✓ Environment: ${process.env.NODE_ENV || "development"}`);
		console.log(`[SERVER] ✓ CORS allowed origins: ${allowedOrigins.join(', ')}`);
		console.log(`[SERVER] ✓ MongoDB connected: ${MONGO_URI.split('@')[1]?.split('/')[0] || 'local'}`);
		console.log(`[SERVER] ✓ Ready to accept requests`);
	});

	// Setup graceful shutdown
	setupGracefulShutdown(server);

	return server;
}

start().catch((err) => {
	console.error("[STARTUP] Failed to start server:", err.message);
	process.exit(1);
});
