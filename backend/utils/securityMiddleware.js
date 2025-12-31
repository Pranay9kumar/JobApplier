// Security middleware: rate limiting, input validation, and secure headers

const { AppError } = require("./errorHandler");

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map();

/**
 * Rate limiter middleware factory
 * Limits requests per IP address
 */
const createRateLimiter = (windowMs = 60000, maxRequests = 100) => {
	return (req, res, next) => {
		const ip = req.ip || req.connection.remoteAddress || "unknown";
		const key = `${ip}:${req.path}`;
		const now = Date.now();

		// Clean old entries
		if (rateLimitStore.has(key)) {
			const requests = rateLimitStore.get(key).filter((time) => now - time < windowMs);
			if (requests.length >= maxRequests) {
				const resetTime = Math.ceil(
					(requests[0] + windowMs - now) / 1000
				);
				res.setHeader("Retry-After", resetTime);
				throw new AppError(
					`Rate limit exceeded. Retry after ${resetTime}s`,
					429,
					{
						code: "RATE_LIMIT_EXCEEDED",
						retryAfter: resetTime,
					}
				);
			}
			requests.push(now);
			rateLimitStore.set(key, requests);
		} else {
			rateLimitStore.set(key, [now]);
		}

		// Set rate limit headers
		const requests = rateLimitStore.get(key);
		res.setHeader("X-RateLimit-Limit", maxRequests);
		res.setHeader(
			"X-RateLimit-Remaining",
			Math.max(0, maxRequests - requests.length)
		);
		res.setHeader(
			"X-RateLimit-Reset",
			new Date(Math.max(...requests) + windowMs).toISOString()
		);

		next();
	};
};

/**
 * AI-specific rate limiter: stricter limits for expensive operations
 * 30 requests per minute for authenticated users
 * 10 requests per minute for unauthenticated users
 */
const aiRateLimiter = (req, res, next) => {
	const isAuth = !!req.user;
	const maxRequests = isAuth ? 30 : 10;
	const windowMs = 60000; // 1 minute

	const ip = req.ip || req.connection.remoteAddress || "unknown";
	const userId = req.user?.id || "anon";
	const key = `ai-limit:${isAuth ? userId : ip}`;
	const now = Date.now();

	// Get or create request list
	let requests = rateLimitStore.get(key) || [];
	requests = requests.filter((time) => now - time < windowMs);

	if (requests.length >= maxRequests) {
		const resetTime = Math.ceil((requests[0] + windowMs - now) / 1000);
		res.setHeader("Retry-After", resetTime);
		throw new AppError(
			`AI rate limit exceeded (${maxRequests}/min). Retry after ${resetTime}s`,
			429,
			{
				code: "AI_RATE_LIMIT_EXCEEDED",
				limit: maxRequests,
				retryAfter: resetTime,
			}
		);
	}

	requests.push(now);
	rateLimitStore.set(key, requests);

	// Set rate limit headers
	res.setHeader("X-RateLimit-Limit", maxRequests);
	res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - requests.length));
	res.setHeader(
		"X-RateLimit-Reset",
		new Date(Math.max(...requests, now) + windowMs).toISOString()
	);

	next();
};

/**
 * Input validation middleware
 * Validates and sanitizes common input types
 */
const validateInput = (schema = {}) => {
	return (req, res, next) => {
		const body = req.body || {};

		// Validate required fields
		for (const [field, rules] of Object.entries(schema)) {
			const value = body[field];

			if (rules.required && (value === undefined || value === null || value === "")) {
				throw new AppError(`${field} is required`, 400, {
					code: "VALIDATION_ERROR",
					field,
				});
			}

			if (value !== undefined && value !== null) {
				// Type validation
				if (rules.type === "string" && typeof value !== "string") {
					throw new AppError(`${field} must be a string`, 400, {
						code: "VALIDATION_ERROR",
						field,
						expected: "string",
						received: typeof value,
					});
				}

				if (rules.type === "number" && typeof value !== "number") {
					throw new AppError(`${field} must be a number`, 400, {
						code: "VALIDATION_ERROR",
						field,
						expected: "number",
						received: typeof value,
					});
				}

				if (rules.type === "boolean" && typeof value !== "boolean") {
					throw new AppError(`${field} must be a boolean`, 400, {
						code: "VALIDATION_ERROR",
						field,
						expected: "boolean",
						received: typeof value,
					});
				}

				// Length validation
				if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
					throw new AppError(
						`${field} must be at least ${rules.minLength} characters`,
						400,
						{
							code: "VALIDATION_ERROR",
							field,
							minLength: rules.minLength,
						}
					);
				}

				if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
					throw new AppError(
						`${field} must be at most ${rules.maxLength} characters`,
						400,
						{
							code: "VALIDATION_ERROR",
							field,
							maxLength: rules.maxLength,
						}
					);
				}

				// Pattern validation (regex)
				if (rules.pattern && !rules.pattern.test(value)) {
					throw new AppError(`${field} format is invalid`, 400, {
						code: "VALIDATION_ERROR",
						field,
						pattern: rules.pattern.toString(),
					});
				}

				// Enum validation
				if (rules.enum && !rules.enum.includes(value)) {
					throw new AppError(`${field} must be one of: ${rules.enum.join(", ")}`, 400, {
						code: "VALIDATION_ERROR",
						field,
						allowedValues: rules.enum,
					});
				}
			}
		}

		next();
	};
};

/**
 * Secure headers middleware
 * Sets security-related HTTP headers
 */
const secureHeaders = (req, res, next) => {
	// Prevent MIME type sniffing
	res.setHeader("X-Content-Type-Options", "nosniff");

	// Enable XSS protection
	res.setHeader("X-XSS-Protection", "1; mode=block");

	// Prevent clickjacking
	res.setHeader("X-Frame-Options", "DENY");

	// Disable feature policy for older browsers
	res.setHeader("X-UA-Compatible", "IE=edge");

	// Referrer policy for privacy
	res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

	// Content Security Policy - strict for extension
	res.setHeader(
		"Content-Security-Policy",
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"
	);

	// Permissions policy (formerly Feature Policy)
	res.setHeader(
		"Permissions-Policy",
		"geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
	);

	// HSTS for HTTPS
	if (process.env.NODE_ENV === "production") {
		res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	}

	// Remove Server header
	res.removeHeader("Server");

	next();
};

/**
 * Email format validation (RFC 5322 simplified)
 */
const isValidEmail = (email) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email) && email.length <= 254;
};

/**
 * Password strength validation
 */
const validatePassword = (password) => {
	if (password.length < 8 || password.length > 128) {
		return { valid: false, message: 'Password must be 8-128 characters' };
	}
	
	const hasUpperCase = /[A-Z]/.test(password);
	const hasLowerCase = /[a-z]/.test(password);
	const hasNumbers = /\d/.test(password);
	const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
	
	const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
	
	if (strength < 3) {
		return { 
			valid: false, 
			message: 'Password must contain uppercase, lowercase, numbers, and special characters' 
		};
	}
	
	return { valid: true };
};

/**
 * Name validation
 */
const isValidName = (name) => {
	const trimmed = name.trim();
	if (trimmed.length < 2 || trimmed.length > 100) return false;
	return /^[a-zA-Z\s\-']+$/.test(trimmed); // Only letters, spaces, hyphens, apostrophes
};

/**
 * Resume text validation
 */
const isValidResumeText = (text) => {
	const trimmed = text.trim();
	return trimmed.length >= 50 && trimmed.length <= 50000;
};

/**
 * Search query validation (prevent injection)
 */
const isValidSearchQuery = (query) => {
	if (query.length === 0) return true; // Empty is ok
	if (query.length > 100) return false;
	
	// Block dangerous patterns
	const dangerousPatterns = [
		/(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|;|--|\*|\/\*)/i,
		/[$\{\}]/,
		/\\x[0-9a-f]{2}/i
	];
	
	for (const pattern of dangerousPatterns) {
		if (pattern.test(query)) return false;
	}
	
	return true;
};

/**
 * Escape HTML to prevent XSS
 */
const escapeHtml = (text) => {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, m => map[m]);
};

/**
 * Sanitize string input to prevent injection
 */
const sanitizeString = (str) => {
	if (typeof str !== "string") return str;
	return str
		.trim()
		.replace(/[<>\"']/g, "") // Remove dangerous characters
		.slice(0, 5000); // Limit length
};

/**
 * Comprehensive input validation for common endpoints
 */
const validateAuthInput = (req, res, next) => {
	const { email, password, name } = req.body || {};
	const endpoint = req.path;

	// Signup validation
	if (endpoint.includes('signup')) {
		if (!email || !isValidEmail(email)) {
			throw new AppError('Invalid email address', 400, {
				code: 'INVALID_EMAIL',
				field: 'email'
			});
		}

		if (!password) {
			throw new AppError('Password is required', 400, {
				code: 'MISSING_PASSWORD',
				field: 'password'
			});
		}

		const passwordValidation = validatePassword(password);
		if (!passwordValidation.valid) {
			throw new AppError(passwordValidation.message, 400, {
				code: 'WEAK_PASSWORD',
				field: 'password'
			});
		}

		if (!name || !isValidName(name)) {
			throw new AppError('Invalid name. Use 2-100 characters with letters, spaces, hyphens, or apostrophes', 400, {
				code: 'INVALID_NAME',
				field: 'name'
			});
		}
	}

	// Login validation
	if (endpoint.includes('login')) {
		if (!email || !isValidEmail(email)) {
			throw new AppError('Invalid email address', 400, {
				code: 'INVALID_EMAIL',
				field: 'email'
			});
		}

		if (!password || password.length === 0) {
			throw new AppError('Password is required', 400, {
				code: 'MISSING_PASSWORD',
				field: 'password'
			});
		}

		if (password.length > 128) {
			throw new AppError('Invalid password format', 400, {
				code: 'INVALID_PASSWORD_FORMAT',
				field: 'password'
			});
		}
	}

	next();
};

/**
 * Validate resume submission
 */
const validateResumeInput = (req, res, next) => {
	const { resumeText } = req.body || {};

	if (!resumeText || !isValidResumeText(resumeText)) {
		throw new AppError(
			'Resume must be between 50 and 50,000 characters',
			400,
			{
				code: 'INVALID_RESUME',
				field: 'resumeText'
			}
		);
	}

	next();
};

/**
 * Validate job search/filter input
 */
const validateJobFilters = (req, res, next) => {
	const { search, sort, location, salary_min, salary_max } = req.query || {};

	if (search && !isValidSearchQuery(search)) {
		throw new AppError('Invalid search query', 400, {
			code: 'INVALID_SEARCH',
			field: 'search'
		});
	}

	if (sort && !['relevance', 'date', 'salary'].includes(sort)) {
		throw new AppError('Invalid sort option', 400, {
			code: 'INVALID_SORT',
			field: 'sort'
		});
	}

	if (location && location.length > 100) {
		throw new AppError('Location string too long', 400, {
			code: 'INVALID_LOCATION',
			field: 'location'
		});
	}

	if (salary_min && (isNaN(salary_min) || parseInt(salary_min) < 0)) {
		throw new AppError('Invalid minimum salary', 400, {
			code: 'INVALID_SALARY_MIN',
			field: 'salary_min'
		});
	}

	if (salary_max && (isNaN(salary_max) || parseInt(salary_max) < 0)) {
		throw new AppError('Invalid maximum salary', 400, {
			code: 'INVALID_SALARY_MAX',
			field: 'salary_max'
		});
	}

	next();
};

module.exports = {
	createRateLimiter,
	aiRateLimiter,
	validateInput,
	secureHeaders,
	isValidEmail,
	validatePassword,
	isValidName,
	isValidResumeText,
	isValidSearchQuery,
	escapeHtml,
	sanitizeString,
	validateAuthInput,
	validateResumeInput,
	validateJobFilters
};
