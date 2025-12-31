const express = require("express");
const Resume = require("../models/Resume");
const User = require("../models/User");
const Application = require("../models/Application");
const Job = require("../models/Job");
const { analyzeJob, remodelResume, explainMatch, improveAnswer } = require("../services/aiService");
const { AppError, asyncHandler } = require("../utils/errorHandler");
const { authMiddleware, TOKEN_TYPES } = require("../utils/authUtils");
const { validateInput } = require("../utils/securityMiddleware");

const router = express.Router();

// All AI endpoints return structured, chat-ready responses:
// { type, message, data, timestamp, suggestedActions, context }
// This structure supports both current UI and future conversational assistant.

// Middleware: require valid auth and support token rotation
const aiAuthMiddleware = authMiddleware([TOKEN_TYPES.WEB, TOKEN_TYPES.EXTENSION]);

router.post(
	"/analyze-job",
	aiAuthMiddleware,
	validateInput({
		jobDescription: { required: true, type: "string", minLength: 50, maxLength: 50000 },
	}),
	asyncHandler(async (req, res) => {
		const { jobDescription } = req.body;

		const resume = await Resume.findOne({ user: req.user._id }).lean();
		if (!resume) {
			throw new AppError("No resume found for user", 404);
		}

		const result = analyzeJob(jobDescription, resume);

		// Include token rotation hint if needed
		if (req.tokenInfo?.shouldRotate) {
			result.tokenRotation = {
				recommended: true,
				message: "Consider refreshing your token",
			};
		}

		res.json(result);
	})
);
router.post(
	"/remodel-resume",
	aiAuthMiddleware,
	asyncHandler(async (req, res) => {
		const resume = await Resume.findOne({ user: req.user._id }).lean();
		if (!resume) {
			throw new AppError("No resume found for user", 404);
		}

		const remodeled = remodelResume(resume);
		res.json({ success: true, remodeled });
	})
);

router.post(
	"/explain-match",
	aiAuthMiddleware,
	validateInput({
		jobDescription: { required: true, type: "string", minLength: 50, maxLength: 50000 },
	}),
	asyncHandler(async (req, res) => {
		const { jobDescription } = req.body;

		const resume = await Resume.findOne({ user: req.user._id }).lean();
		if (!resume) {
			throw new AppError("No resume found for user", 404);
		}

		const result = explainMatch(jobDescription, resume);
		res.json(result);
	})
);

router.post(
	"/remodel-preview",
	aiAuthMiddleware,
	validateInput({
		jobDescription: { required: true, type: "string", minLength: 50, maxLength: 50000 },
	}),
	asyncHandler(async (req, res) => {
		const { jobDescription } = req.body;

		const resume = await Resume.findOne({ user: req.user._id }).lean();
		if (!resume) {
			throw new AppError("No resume found for user", 404);
		}

		const result = remodelResume(resume, jobDescription);

		// Format human-readable change list
		const changeList = [];
		if (result.data.diff.skillsChanges.reordered) {
			changeList.push(
				`✓ Reordered ${result.data.diff.skillsChanges.highlighted.length} job-relevant skills to the top`
			);
			changeList.push(
				`  Highlighted: ${result.data.diff.skillsChanges.highlighted.join(", ")}`
			);
		}
		if (
			result.data.diff.sectionsOrder.original.join(",") !==
			result.data.diff.sectionsOrder.remodeled.join(",")
		) {
			changeList.push(`✓ Optimized section order for ATS scanning`);
		}
		if (changeList.length === 0) {
			changeList.push("✓ No changes needed - your resume is already well-structured");
		}

		// Add safety notes
		changeList.push("• No skills added or removed");
		changeList.push("• No experience fabricated");
		changeList.push("• Only reordering of existing content");

		res.json({
			...result,
			preview: {
				before: result.data.original,
				after: result.data.remodeled,
				changes: changeList,
				diff: result.data.diff,
				requiresConfirmation: true,
				confirmationMessage: "Review the changes above and confirm to save this tailored version.",
			},
		});
	})
);

router.post(
	"/improve-answer",
	aiAuthMiddleware,
	validateInput({
		question: { required: true, type: "string", minLength: 10, maxLength: 1000 },
		jobDescription: { required: true, type: "string", minLength: 50, maxLength: 50000 },
	}),
	asyncHandler(async (req, res) => {
		const { question, jobDescription } = req.body;

		// Fetch user's current answer
		const currentAnswer = req.user.getAnswer(question);
		if (!currentAnswer) {
			throw new AppError("No stored answer found for this question", 404, { question });
		}

		// Improve the answer
		const improvement = improveAnswer(currentAnswer.text, jobDescription);

		// If improvement was successful and confident, store the new version
		if (
			improvement.data.confidence >= 50 &&
			improvement.data.improved !== currentAnswer.text
		) {
			req.user.setAnswer(question, improvement.data.improved, {
				isAIImproved: true,
				originalVersionId: currentAnswer.versionId,
			});
			await req.user.save();
		}

		// Return formatted response with before/after
		res.json({
			...improvement,
			data: {
				...improvement.data,
				applied:
					improvement.data.confidence >= 50 &&
					improvement.data.improved !== currentAnswer.text,
				userAction: "Review improved answer",
			},
		});
	})
);

// POST /api/ai/record-application
// Record that user applied to a job (for analytics and tracking)
// Request body: { jobId, jobSnapshot, matchScore?, matchedSkills?, missingSkills?, notes? }
router.post(
	"/record-application",
	aiAuthMiddleware,
	validateInput({
		jobId: { required: true, type: "string" },
		jobSnapshot: { required: true, type: "object" },
		notes: { required: false, type: "string", maxLength: 2000 },
	}),
	asyncHandler(async (req, res) => {
		const { jobId, jobSnapshot, matchScore, matchedSkills, missingSkills, notes } = req.body;

		// Verify job exists or create minimal record
		let job = await Job.findById(jobId);
		if (!job) {
			// Create job record if it doesn't exist (from external scraping)
			job = await Job.create({
				title: jobSnapshot.title,
				company: jobSnapshot.company,
				location: jobSnapshot.location,
				description: jobSnapshot.description,
				source: jobSnapshot.source || "extension",
			});
		}

		// Create application record
		const application = await Application.create({
			user: req.user._id,
			job: job._id,
			jobSnapshot: {
				title: jobSnapshot.title,
				company: jobSnapshot.company,
				location: jobSnapshot.location,
				description: jobSnapshot.description,
				source: jobSnapshot.source || "extension",
			},
			status: "applied", // Default status is "applied" when recorded
			matchScoreSnapshot: matchScore || null,
			matchedSkills: matchedSkills || [],
			missingSkills: missingSkills || [],
			notes: notes || null,
			aiMatched: !!matchScore,
		});

		res.status(201).json({
			type: "application",
			message: "Application recorded",
			data: {
				id: application._id,
				status: application.status,
				appliedAt: application.appliedAt,
				matchScore: application.matchScoreSnapshot,
				nextAction: "Monitor for interviews and update status",
			},
			timestamp: new Date().toISOString(),
			suggestedActions: [
				{
					action: "update-status",
					description: "Mark as interviewed or rejected when you hear back",
				},
				{
					action: "view-analytics",
					description: "Check your application analytics",
				},
			],
		});
	})
);

module.exports = router;

