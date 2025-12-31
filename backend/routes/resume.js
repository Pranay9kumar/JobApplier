const express = require("express");
const Resume = require("../models/Resume");
const { authMiddleware, TOKEN_TYPES } = require("../utils/authUtils");
const { AppError, asyncHandler } = require("../utils/errorHandler");
const { validateInput } = require("../utils/securityMiddleware");

const router = express.Router();

const authRequired = authMiddleware([TOKEN_TYPES.WEB, TOKEN_TYPES.EXTENSION]);

// POST /api/resume - Create or update user resume
router.post(
	"/resume",
	authRequired,
	validateInput({
		resumeText: { required: true, type: "string", minLength: 50, maxLength: 50000 },
	}),
	asyncHandler(async (req, res) => {
		const { resumeText } = req.body;
		const userId = req.user._id;

		// Extract skills from resume text (simple keyword matching)
		const knownSkills = [
			"React",
			"Vue",
			"Angular",
			"Node.js",
			"Express",
			"MongoDB",
			"PostgreSQL",
			"TypeScript",
			"JavaScript",
			"Python",
			"Java",
			"C++",
			"Go",
			"Rust",
			"AWS",
			"Azure",
			"GCP",
			"Docker",
			"Kubernetes",
			"Git",
			"CI/CD",
			"REST",
			"GraphQL",
		];

		const parsedSkills = knownSkills.filter(
			(skill) =>
				resumeText.toLowerCase().includes(skill.toLowerCase()) ||
				resumeText.toLowerCase().includes(skill.split(".")[0].toLowerCase())
		);

		// Extract years of experience (heuristic)
		const yearsMatch = resumeText.match(/(\d+)\+?\s*years/i);
		const yearsExp = yearsMatch ? parseInt(yearsMatch[1]) : 0;

		// Find or create resume
		let resume = await Resume.findOne({ user: userId });

		if (resume) {
			// Update existing resume
			resume.originalText = resumeText;
			resume.originalParsedSkills = parsedSkills;
		} else {
			// Create new resume
			resume = new Resume({
				user: userId,
				originalText: resumeText,
				originalParsedSkills: parsedSkills,
				activeVersionId: null,
			});
		}

		await resume.save();

		res.status(201).json({
			success: true,
			message: "Resume saved successfully",
			data: {
				id: resume._id,
				skills: parsedSkills,
				yearsExperience: yearsExp,
				wordCount: resumeText.split(/\s+/).length,
			},
		});
	})
);

// GET /api/resume - Get user resume
router.get(
	"/resume",
	authRequired,
	asyncHandler(async (req, res) => {
		const resume = await Resume.findOne({ user: req.user._id });

		if (!resume) {
			throw new AppError("No resume found", 404);
		}

		res.json({
			success: true,
			data: {
				id: resume._id,
				text: resume.originalText,
				skills: resume.originalParsedSkills,
				yearsExperience: resume.yearsExp,
				createdAt: resume.createdAt,
			},
		});
	})
);

module.exports = router;
