// Global error handling utilities
// Provides standardized error responses, request ID tracking, and graceful error logging

const NODE_ENV = process.env.NODE_ENV || "development";

// Standard error response formatter
class AppError extends Error {
	constructor(message, statusCode, details = null) {
		super(message);
		this.statusCode = statusCode;
		this.details = details;
		this.timestamp = new Date().toISOString();
	}
}

// Error response standardizer
const formatErrorResponse = (error, requestId, isDevelopment = false) => {
	const response = {
		success: false,
		error: {
			message: error.message || "Internal server error",
			code: error.code || "INTERNAL_ERROR",
			requestId,
			timestamp: error.timestamp || new Date().toISOString(),
		},
	};

	// Include details in development only
	if (isDevelopment && error.details) {
		response.error.details = error.details;
	}

	// Include stack trace in development
	if (isDevelopment && error.stack) {
		response.error.stack = error.stack;
	}

	return response;
};

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
	// Use X-Request-ID header if provided, otherwise generate UUID
	const requestId =
		req.headers["x-request-id"] ||
		`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	req.id = requestId;
	res.setHeader("X-Request-ID", requestId);

	// Add timing info
	req.startTime = Date.now();

	next();
};

// Request logging middleware
const requestLoggingMiddleware = (req, res, next) => {
	const logRequest = () => {
		const duration = Date.now() - req.startTime;
		const status = res.statusCode;
		const method = req.method;
		const path = req.path;
		const requestId = req.id;

		// Color code log based on status
		let statusIcon = "✓";
		if (status >= 400) statusIcon = "✕";
		if (status >= 500) statusIcon = "⚠";

		console.log(
			`[${requestId}] ${statusIcon} ${method.padEnd(6)} ${path.padEnd(40)} ${status} (${duration}ms)`
		);

		// Log errors separately
		if (status >= 400 && res.locals.error) {
			console.error(
				`[${requestId}] Error: ${res.locals.error.message || "Unknown error"}`
			);
		}
	};

	res.on("finish", logRequest);
	next();
};

// Global error handler middleware (MUST be last middleware)
const errorHandler = (err, req, res, next) => {
	const requestId = req.id || `error-${Date.now()}`;
	const isDevelopment = NODE_ENV === "development";

	let error = err;

	// Handle different error types
	if (!(err instanceof AppError)) {
		// Convert non-AppError errors
		let statusCode = err.statusCode || 500;
		let message = err.message || "Internal server error";
		let code = "INTERNAL_ERROR";

		// Handle specific error types
		if (err.name === "ValidationError") {
			statusCode = 400;
			code = "VALIDATION_ERROR";
			message = "Invalid request data";
		} else if (err.name === "UnauthorizedError") {
			statusCode = 401;
			code = "UNAUTHORIZED";
			message = "Unauthorized access";
		} else if (err.name === "JsonWebTokenError") {
			statusCode = 401;
			code = "INVALID_TOKEN";
			message = "Invalid or expired token";
		} else if (err.name === "MongoError" || err.name === "MongoServerError") {
			statusCode = 500;
			code = "DATABASE_ERROR";
			if (isDevelopment) {
				message = err.message;
			} else {
				message = "Database operation failed";
			}
		}

		error = new AppError(message, statusCode, isDevelopment ? err : null);
		error.code = code;
	}

	// Store error in response locals for logging middleware
	res.locals.error = error;

	// Format and send response
	const statusCode = error.statusCode || 500;
	const response = formatErrorResponse(error, requestId, isDevelopment);

	res.status(statusCode).json(response);

	// Log error in production
	if (!isDevelopment) {
		console.error(
			`[${requestId}] ${error.message} - Status: ${statusCode}`,
			error.details || ""
		);
	}
};

// Async handler wrapper to catch errors in route handlers
const asyncHandler = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
};

// Graceful shutdown handler
const setupGracefulShutdown = (server) => {
	let isShuttingDown = false;

	const shutdown = (signal) => {
		if (isShuttingDown) return;
		isShuttingDown = true;

		console.log(`\n[SHUTDOWN] Received ${signal}, gracefully shutting down...`);

		// Stop accepting new connections
		server.close(async () => {
			console.log("[SHUTDOWN] HTTP server closed");

			// Close database connection
			try {
				const mongoose = require("mongoose");
				await mongoose.connection.close();
				console.log("[SHUTDOWN] Database connection closed");
				process.exit(0);
			} catch (err) {
				console.error("[SHUTDOWN] Error closing database:", err.message);
				process.exit(1);
			}
		});

		// Force shutdown after timeout
		setTimeout(() => {
			console.error(
				"[SHUTDOWN] Could not close connections in time, forcefully shutting down"
			);
			process.exit(1);
		}, 10000);
	};

	// Handle shutdown signals
	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));

	// Handle uncaught exceptions
	process.on("uncaughtException", (err) => {
		console.error("[CRITICAL] Uncaught exception:", err);
		shutdown("UNCAUGHT_EXCEPTION");
	});

	// Handle unhandled promise rejections
	process.on("unhandledRejection", (reason, promise) => {
		console.error("[CRITICAL] Unhandled rejection at:", promise, "reason:", reason);
		shutdown("UNHANDLED_REJECTION");
	});
};

module.exports = {
	AppError,
	errorHandler,
	requestIdMiddleware,
	requestLoggingMiddleware,
	asyncHandler,
	setupGracefulShutdown,
	formatErrorResponse,
};
