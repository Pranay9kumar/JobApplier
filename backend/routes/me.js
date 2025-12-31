const express = require("express");
const User = require("../models/User");
const Resume = require("../models/Resume");
const Application = require("../models/Application");
const { authMiddleware, TOKEN_TYPES } = require("../utils/authUtils");
const { AppError, asyncHandler } = require("../utils/errorHandler");
const { validateInput } = require("../utils/securityMiddleware");

const router = express.Router();

// Use enhanced auth middleware from authUtils
const authRequired = authMiddleware([TOKEN_TYPES.WEB, TOKEN_TYPES.EXTENSION]);

router.get("/me", authRequired, asyncHandler(async (req, res) => {
	const user = req.user;
	const resume = await Resume.findOne({ user: user._id }).lean();

	return res.json({
		user: {
			id: user._id,
			name: user.name,
			email: user.email,
			createdAt: user.createdAt,
		},
		resume: {
			summary: resume?.summary || "",
			answers: resume?.answers || [],
		},
	});
}));

// PUT /api/applications/:id
// Update application status (e.g., mark as interviewed, rejected, offer)
router.put(
	"/applications/:id",
	authRequired,
	validateInput({
		status: {
			required: true,
			type: "string",
			enum: ["applied", "interviewing", "rejected", "offer", "accepted"],
		},
		notes: { required: false, type: "string", maxLength: 2000 },
	}),
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const { status, notes } = req.body;

		// Verify application belongs to user
		const application = await Application.findById(id);
		if (!application) {
			throw new AppError("Application not found", 404);
		}

		if (application.user.toString() !== req.user._id.toString()) {
			throw new AppError("Unauthorized: application belongs to another user", 403);
		}

		// Update status
		application.status = status;
		application.statusUpdatedAt = new Date();

		// Add or append notes
		if (notes) {
			application.notes = notes;
		}

		await application.save();

		res.json({
			type: "application",
			message: "Application status updated",
			data: {
				id: application._id,
				status: application.status,
				statusUpdatedAt: application.statusUpdatedAt,
				notes: application.notes,
				nextAction:
					status === "interviewing"
						? "Prepare for interview"
						: status === "offer"
						? "Review offer details"
						: "Continue your job search",
			},
			timestamp: new Date().toISOString(),
		});
	})
);

module.exports = router;
