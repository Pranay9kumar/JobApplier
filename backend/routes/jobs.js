const express = require("express");
const jwt = require("jsonwebtoken");
const Job = require("../models/Job");
const Resume = require("../models/Resume");
const User = require("../models/User");
const { analyzeJob, rankJobs } = require("../services/aiService");const { AppError, asyncHandler } = require("../utils/errorHandler");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-prod";

// Optional auth middleware: sets req.user if token is valid, continues otherwise
const optionalAuth = async (req, res, next) => {
	try {
		const header = req.headers.authorization || "";
		const token = header.startsWith("Bearer ") ? header.slice(7) : null;
		if (!token) return next();

		const payload = jwt.verify(token, JWT_SECRET);
		const user = await User.findById(payload.userId);
		if (user) req.user = user;
		next();
	} catch (err) {
		next(); // Continue without user if token invalid
	}
};

// Placeholder for future aggregators (career sites, public ATS, job APIs only)
// Excludes restricted sources: LinkedIn, Naukri, Indeed.

router.get(
	"/jobs",
	optionalAuth,
	asyncHandler(async (req, res) => {
		const { q, location, company, minScore } = req.query;
		const filter = {};

		if (q) {
			filter.title = { $regex: q, $options: "i" };
		}
		if (location) {
			filter.location = { $regex: location, $options: "i" };
		}
		if (company) {
			filter.company = { $regex: company, $options: "i" };
		}
		filter.source = { $ne: "restricted" }; // ensure we never serve restricted sources

		let jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100).lean();

		// If user is authenticated, compute relevance scores using advanced ranking
		if (req.user) {
			const resume = await Resume.findOne({ user: req.user._id }).lean();
			if (resume) {
				// Parse optional custom weights from query params
				const customWeights = {};
				if (req.query.skillWeight)
					customWeights.skillMatch = parseFloat(req.query.skillWeight);
				if (req.query.expWeight)
					customWeights.experienceFit = parseFloat(req.query.expWeight);
				if (req.query.locWeight) customWeights.location = parseFloat(req.query.locWeight);
				if (req.query.recencyWeight)
					customWeights.recency = parseFloat(req.query.recencyWeight);

				// Rank jobs using multi-factor scoring
				jobs = rankJobs(jobs, resume, req.user.location || "", customWeights);

				// Filter by minScore if provided
				if (minScore) {
					const min = Number(minScore);
					jobs = jobs.filter((job) => job.rankingScore >= min);
				}

				// If no custom weights provided, sort by rankingScore
				// (rankJobs already sorts, but preserve if weights modified)
				if (Object.keys(customWeights).length === 0) {
					jobs.sort((a, b) => b.rankingScore - a.rankingScore);
				}
			}
		}

		res.json({ success: true, jobs, authenticated: !!req.user });
	})
);

module.exports = router;
