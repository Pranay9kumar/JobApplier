// Enhanced JWT authentication utilities
// Supports token rotation, expiry handling, and token type differentiation

const jwt = require("jsonwebtoken");
const { AppError } = require("./errorHandler");

// Load JWT configuration from environment
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
const ROTATION_WINDOW = 60; // Accept tokens within 60 seconds of expiry for rotation

// Validate required environment variables
if (!JWT_SECRET || JWT_SECRET === "CHANGE_ME_GENERATE_RANDOM_32_CHAR_STRING") {
	console.error("[AUTH] FATAL: JWT_SECRET not configured properly!");
	console.error("[AUTH] Generate a secure secret: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
	process.exit(1);
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === "CHANGE_ME_GENERATE_DIFFERENT_RANDOM_32_CHAR_STRING") {
	console.error("[AUTH] FATAL: JWT_REFRESH_SECRET not configured properly!");
	console.error("[AUTH] Generate a secure secret: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
	process.exit(1);
}

if (JWT_SECRET === JWT_REFRESH_SECRET) {
	console.error("[AUTH] FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different!");
	process.exit(1);
}

// Token types for differentiation
const TOKEN_TYPES = {
	WEB: "web", // Web client tokens
	EXTENSION: "extension", // Chrome extension tokens
	REFRESH: "refresh", // Refresh tokens for rotation
};

/**
 * Sign an access token with optional type differentiation
 * Supports web clients and extension clients separately
 */
const signAccessToken = (userId, tokenType = TOKEN_TYPES.WEB) => {
	return jwt.sign(
		{
			userId,
			type: tokenType,
			issuedAt: Date.now(),
		},
		JWT_SECRET,
		{
			expiresIn: JWT_EXPIRES_IN,
		}
	);
};

/**
 * Sign a refresh token for token rotation
 * Used to issue new access tokens without re-authentication
 */
const signRefreshToken = (userId, tokenType = TOKEN_TYPES.WEB) => {
	return jwt.sign(
		{
			userId,
			type: tokenType,
			issuedAt: Date.now(),
		},
		JWT_REFRESH_SECRET,
		{
			expiresIn: "30d", // Refresh tokens live longer
		}
	);
};

/**
 * Verify and parse access token
 * Returns payload if valid, throws error if expired or invalid
 */
const verifyAccessToken = (token) => {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (err) {
		if (err.name === "TokenExpiredError") {
			throw new AppError("Token expired", 401, {
				code: "TOKEN_EXPIRED",
				expiredAt: err.expiredAt,
			});
		}
		throw new AppError("Invalid token", 401, {
			code: "INVALID_TOKEN",
		});
	}
};

/**
 * Verify refresh token
 * Returns payload if valid, throws error otherwise
 */
const verifyRefreshToken = (token) => {
	try {
		return jwt.verify(token, JWT_REFRESH_SECRET);
	} catch (err) {
		throw new AppError("Invalid refresh token", 401, {
			code: "INVALID_REFRESH_TOKEN",
		});
	}
};

/**
 * Token rotation: Accept tokens near expiry and issue new ones
 * This allows seamless token refresh without forcing re-authentication
 */
const attemptTokenRotation = (token) => {
	try {
		// Try to verify normally first
		return {
			valid: true,
			payload: jwt.verify(token, JWT_SECRET),
			shouldRotate: false,
		};
	} catch (err) {
		if (err.name === "TokenExpiredError") {
			// Check if token is within rotation window
			const now = Math.floor(Date.now() / 1000);
			const expiredAt = err.expiredAt ? Math.floor(err.expiredAt.getTime() / 1000) : 0;
			const timeSinceExpiry = now - expiredAt;

			if (timeSinceExpiry <= ROTATION_WINDOW) {
				// Token recently expired, allow rotation
				try {
					const payload = jwt.decode(token); // Get payload without verification
					return {
						valid: true,
						payload,
						shouldRotate: true,
					};
				} catch (_) {
					throw new AppError("Token rotation failed", 401);
				}
			} else {
				// Token expired too long ago
				throw new AppError("Token expired, please login again", 401, {
					code: "TOKEN_EXPIRED_NO_ROTATION",
				});
			}
		}
		throw new AppError("Invalid token", 401, {
			code: "INVALID_TOKEN",
		});
	}
};

/**
 * Create token response with both access and refresh tokens
 */
const createTokenResponse = (userId, tokenType = TOKEN_TYPES.WEB) => {
	const accessToken = signAccessToken(userId, tokenType);
	const refreshToken = signRefreshToken(userId, tokenType);

	return {
		accessToken,
		refreshToken,
		expiresIn: JWT_EXPIRES_IN,
		tokenType: "Bearer",
	};
};

/**
 * Auth middleware with token rotation support
 */
const authMiddleware = (allowedTypes = null) => {
	return async (req, res, next) => {
		try {
			const header = req.headers.authorization || "";
			const token = header.startsWith("Bearer ") ? header.substring(7) : null;

			if (!token) {
				throw new AppError("Missing authentication token", 401, {
					code: "MISSING_TOKEN",
				});
			}

			// Attempt token rotation (allows recently expired tokens)
			const tokenCheck = attemptTokenRotation(token);

			// Check token type if specified
			if (allowedTypes && !allowedTypes.includes(tokenCheck.payload.type)) {
				throw new AppError("Invalid token type for this endpoint", 403, {
					code: "INVALID_TOKEN_TYPE",
					expected: allowedTypes,
					received: tokenCheck.payload.type,
				});
			}

			// Load user
			const User = require("../models/User");
			const user = await User.findById(tokenCheck.payload.userId);
			if (!user) {
				throw new AppError("User not found", 404, {
					code: "USER_NOT_FOUND",
				});
			}

			req.user = user;
			req.tokenInfo = {
				payload: tokenCheck.payload,
				shouldRotate: tokenCheck.shouldRotate,
				originalToken: token,
			};

			next();
		} catch (err) {
			next(err);
		}
	};
};

/**
 * Optional auth middleware - doesn't fail if token missing/invalid
 */
const optionalAuthMiddleware = (req, res, next) => {
	try {
		const header = req.headers.authorization || "";
		const token = header.startsWith("Bearer ") ? header.substring(7) : null;

		if (token) {
			try {
				const payload = verifyAccessToken(token);
				const User = require("../models/User");
				// Load user asynchronously but don't block if fails
				User.findById(payload.userId).then((user) => {
					if (user) {
						req.user = user;
						req.tokenInfo = { payload };
					}
					next();
				});
				return;
			} catch (_) {
				// Continue without user if token invalid
			}
		}
		next();
	} catch (err) {
		next(); // Continue without failing
	}
};

module.exports = {
	TOKEN_TYPES,
	signAccessToken,
	signRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
	attemptTokenRotation,
	createTokenResponse,
	authMiddleware,
	optionalAuthMiddleware,
	ROTATION_WINDOW,
};
