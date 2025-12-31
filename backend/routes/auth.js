const express = require("express");
const User = require("../models/User");
const { AppError, asyncHandler } = require("../utils/errorHandler");
const {
	TOKEN_TYPES,
	createTokenResponse,
	authMiddleware,
	verifyRefreshToken,
	signAccessToken,
} = require("../utils/authUtils");
const { validateInput, isValidEmail } = require("../utils/securityMiddleware");

const router = express.Router();

// POST /api/auth/signup - Register new user with token response
router.post(
	"/signup",
	validateInput({
		email: { required: true, type: "string", minLength: 5, maxLength: 254 },
		password: { required: true, type: "string", minLength: 8, maxLength: 128 },
		name: { required: false, type: "string", maxLength: 100 },
		tokenType: {
			required: false,
			type: "string",
			enum: [TOKEN_TYPES.WEB, TOKEN_TYPES.EXTENSION],
		},
	}),
	asyncHandler(async (req, res) => {
		const { name, email, password, tokenType = TOKEN_TYPES.WEB } = req.body;

		// Email validation
		if (!isValidEmail(email)) {
			throw new AppError("Invalid email format", 400, {
				field: "email",
			});
		}

		// Check existing user
		const existing = await User.findOne({ email: email.toLowerCase().trim() });
		if (existing) {
			throw new AppError("Email already registered", 409, {
				field: "email",
			});
		}

		// Create user with hashed password
		const passwordHash = await User.hashPassword(password);
		const user = await User.create({
			name: name || email.split("@")[0],
			email: email.toLowerCase().trim(),
			passwordHash,
		});

		// Create token response with specified type
		const tokenResponse = createTokenResponse(user._id, tokenType);

		res.status(201).json({
			success: true,
			...tokenResponse,
			user: { id: user._id, email: user.email, name: user.name },
		});
	})
);

// POST /api/auth/login - Authenticate user with token response
router.post(
	"/login",
	validateInput({
		email: { required: true, type: "string" },
		password: { required: true, type: "string" },
		tokenType: {
			required: false,
			type: "string",
			enum: [TOKEN_TYPES.WEB, TOKEN_TYPES.EXTENSION],
		},
	}),
	asyncHandler(async (req, res) => {
		const { email, password, tokenType = TOKEN_TYPES.WEB } = req.body;

		// Find user and verify password
		const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
			"+passwordHash"
		);
		if (!user) {
			throw new AppError("Invalid email or password", 401);
		}

		const isValid = await user.comparePassword(password);
		if (!isValid) {
			throw new AppError("Invalid email or password", 401);
		}

		// Create token response with specified type
		const tokenResponse = createTokenResponse(user._id, tokenType);

		const safeUser = user.toObject();
		delete safeUser.passwordHash;

		res.json({
			success: true,
			...tokenResponse,
			user: { id: user._id, email: user.email, name: user.name },
		});
	})
);

// POST /api/auth/refresh - Rotate tokens using refresh token
router.post(
	"/refresh",
	validateInput({
		refreshToken: { required: true, type: "string" },
	}),
	asyncHandler(async (req, res) => {
		const { refreshToken } = req.body;

		try {
			const payload = verifyRefreshToken(refreshToken);

			// Get user to ensure still active
			const user = await User.findById(payload.userId);
			if (!user) {
				throw new AppError("User not found", 404);
			}

			// Issue new token pair
			const tokenResponse = createTokenResponse(user._id, payload.type);

			res.json({
				success: true,
				...tokenResponse,
			});
		} catch (err) {
			throw new AppError("Token refresh failed", 401, {
				code: "REFRESH_FAILED",
			});
		}
	})
);

// GET /api/auth/me - Get current user profile
router.get(
	"/me",
	authMiddleware(),
	asyncHandler(async (req, res) => {
		// If token is about to expire, suggest rotation
		const shouldRotate = req.tokenInfo?.shouldRotate;

		res.json({
			success: true,
			user: {
				id: req.user._id,
				email: req.user.email,
				name: req.user.name,
			},
			tokenRotation: shouldRotate
				? {
						recommended: true,
						message: "Token is near expiry. Consider refreshing.",
					}
				: undefined,
		});
	})
);

module.exports = router;
