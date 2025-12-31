// Analytics endpoints: provide user-facing insights about job applications
const express = require("express");
const router = express.Router();

const Application = require("../models/Application");
const { authMiddleware } = require("../utils/authUtils");
const { asyncHandler } = require("../utils/errorHandler");
const { validateInput } = require("../utils/securityMiddleware");

// All analytics endpoints require authentication
router.use(authMiddleware(["web", "extension"]));

// GET /api/analytics/applications-by-week
// Returns applications grouped by week with interview counts and trends
router.get(
	"/applications-by-week",
	asyncHandler(async (req, res) => {
		const { weeks = 12 } = req.query;
		const userId = req.user._id;

		const data = await Application.getApplicationsByWeek(userId, parseInt(weeks));

		// Format for frontend with human-readable dates
		const formatted = data.map((item) => {
			const date = new Date(item._id.year, 0, 1);
			date.setDate(date.getDate() + (item._id.week - 1) * 7);
			return {
				week: `${date.getFullYear()}-W${String(item._id.week).padStart(2, "0")}`,
				dateStart: date.toISOString().split("T")[0],
				applications: item.count,
				interviews: item.interviews,
				interviewRate: item.count > 0 ? ((item.interviews / item.count) * 100).toFixed(1) : 0,
			};
		});

		// Calculate trend
		const trend =
			formatted.length >= 2
				? formatted[formatted.length - 1].applications -
				  formatted[formatted.length - 2].applications
				: 0;

		const totalApplications = formatted.reduce((sum, w) => sum + w.applications, 0);
		const totalInterviews = formatted.reduce((sum, w) => sum + w.interviews, 0);

		res.json({
			type: "analytics",
			message: "Applications by week",
			data: {
				weeks: formatted,
				summary: {
					totalApplications,
					totalInterviews,
					overallInterviewRate:
						totalApplications > 0
							? ((totalInterviews / totalApplications) * 100).toFixed(1)
							: 0,
					trend,
					trendDirection: trend > 0 ? "up" : trend < 0 ? "down" : "flat",
					averagePerWeek:
						formatted.length > 0
							? (totalApplications / formatted.length).toFixed(1)
							: 0,
				},
				insights: generateApplicationInsights(formatted),
			},
			timestamp: new Date().toISOString(),
		});
	})
);

// GET /api/analytics/conversion-metrics
// Returns application funnel: applied → interviewing → offers → accepted
router.get(
	"/conversion-metrics",
	asyncHandler(async (req, res) => {
		const userId = req.user._id;
		const metrics = await Application.getConversionMetrics(userId);

		res.json({
			type: "analytics",
			message: "Conversion metrics",
			data: {
				funnel: {
					applications: metrics.totalApplications,
					interviewing: metrics.interviewing,
					offers: metrics.offers,
					accepted: metrics.accepted,
				},
				rates: {
					conversionToOffer: metrics.conversionRate,
					conversionToInterview: metrics.interviewRate,
				},
				distribution: {
					applied: metrics.applied,
					interviewing: metrics.interviewing,
					rejected: metrics.rejected,
					offers: metrics.offers,
					accepted: metrics.accepted,
				},
				insights: generateConversionInsights(metrics),
			},
			timestamp: new Date().toISOString(),
		});
	})
);

// GET /api/analytics/missing-skills
// Returns skills most frequently missing from applied jobs
router.get(
	"/missing-skills",
	asyncHandler(async (req, res) => {
		const { limit = 10 } = req.query;
		const userId = req.user._id;

		const skills = await Application.getMissingSkillsAnalysis(userId, parseInt(limit));

		// Calculate total applications for context
		const totalApps = await Application.countDocuments({ user: userId });

		// Format with percentages
		const formatted = skills.map((item) => ({
			skill: item.skill,
			frequency: item.frequency,
			percentageOfJobs: ((item.frequency / totalApps) * 100).toFixed(1),
			exampleJobs: item.exampleJobs.slice(0, 2),
		}));

		res.json({
			type: "analytics",
			message: "Most missing skills",
			data: {
				skills: formatted,
				summary: {
					totalApplicationsAnalyzed: totalApps,
					topSkill: formatted[0]?.skill || null,
					topSkillFrequency: formatted[0]?.frequency || 0,
					averageSkillsPerJob:
						totalApps > 0
							? (
									skills.reduce((sum, s) => sum + s.frequency, 0) /
									totalApps
							  ).toFixed(1)
							: 0,
				},
				insights: generateSkillInsights(formatted, totalApps),
			},
			timestamp: new Date().toISOString(),
		});
	})
);

// GET /api/analytics/dashboard
// Comprehensive dashboard with all metrics
router.get(
	"/dashboard",
	asyncHandler(async (req, res) => {
		const userId = req.user._id;

		// Fetch all data in parallel
		const [applications, conversionMetrics, missingSkills, weeklyData] =
			await Promise.all([
				Application.countDocuments({ user: userId }),
				Application.getConversionMetrics(userId),
				Application.getMissingSkillsAnalysis(userId, 5),
				Application.getApplicationsByWeek(userId, 4),
			]);

		// Calculate additional metrics
		const recentApps = await Application.find({ user: userId })
			.sort({ appliedAt: -1 })
			.limit(5)
			.lean();

		const thisWeekApps = await Application.countDocuments({
			user: userId,
			appliedAt: {
				$gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
			},
		});

		res.json({
			type: "analytics",
			message: "Dashboard overview",
			data: {
				summary: {
					totalApplications: applications,
					thisWeek: thisWeekApps,
					conversionRate: conversionMetrics.conversionRate,
					interviewRate: conversionMetrics.interviewRate,
				},
				funnel: {
					applications: conversionMetrics.totalApplications,
					interviewing: conversionMetrics.interviewing,
					offers: conversionMetrics.offers,
					accepted: conversionMetrics.accepted,
				},
				topMissingSkills: missingSkills
					.slice(0, 3)
					.map((s) => ({ skill: s._id, count: s.count })),
				recentApplications: recentApps.map((app) => ({
					id: app._id,
					title: app.jobSnapshot?.title || "Unknown",
					company: app.jobSnapshot?.company || "Unknown",
					status: app.status,
					appliedAt: app.appliedAt,
				})),
				insights: generateDashboardInsights(
					applications,
					thisWeekApps,
					conversionMetrics,
					missingSkills,
					weeklyData
				),
			},
			timestamp: new Date().toISOString(),
		});
	})
);

// Helper: Generate human-readable application insights
function generateApplicationInsights(weeks) {
	const insights = [];

	if (weeks.length === 0) {
		insights.push({
			level: "info",
			message: "No applications yet. Start applying to jobs!",
		});
		return insights;
	}

	const recent = weeks[weeks.length - 1];
	const previous = weeks.length > 1 ? weeks[weeks.length - 2] : null;

	// Trend insight
	if (previous) {
		if (recent.applications > previous.applications) {
			insights.push({
				level: "positive",
				message: `Great! You increased applications by ${recent.applications - previous.applications} this week.`,
			});
		} else if (recent.applications < previous.applications) {
			insights.push({
				level: "warning",
				message: `Application pace slowed. Consider increasing applications this week.`,
			});
		}
	}

	// Interview rate insight
	if (recent.interviewRate > 5) {
		insights.push({
			level: "positive",
			message: `Your interview rate is ${recent.interviewRate}% - this is excellent!`,
		});
	}

	// Activity level
	const avgPerWeek =
		weeks.reduce((sum, w) => sum + w.applications, 0) / weeks.length;
	if (avgPerWeek < 2) {
		insights.push({
			level: "info",
			message:
				"Consider applying to 2-3 jobs per week for better results.",
		});
	}

	return insights;
}

// Helper: Generate human-readable conversion insights
function generateConversionInsights(metrics) {
	const insights = [];

	if (metrics.totalApplications === 0) {
		insights.push({
			level: "info",
			message: "Apply to jobs to see conversion metrics.",
		});
		return insights;
	}

	// Offer rate insight
	if (metrics.conversionRate > 10) {
		insights.push({
			level: "positive",
			message: `Excellent! Your offer rate (${metrics.conversionRate}%) is above average.`,
		});
	} else if (metrics.conversionRate < 2) {
		insights.push({
			level: "warning",
			message:
				"Low offer rate. Review your resume and cover letter approach.",
		});
	}

	// Interview rate insight
	if (metrics.interviewRate > 15) {
		insights.push({
			level: "positive",
			message: `Strong interview rate (${metrics.interviewRate}%)! Focus on offer negotiation.`,
		});
	}

	// Rejection analysis
	if (metrics.rejected > metrics.interviewing + metrics.offers) {
		insights.push({
			level: "info",
			message:
				"Many rejections at screen stage. Consider refining your resume targeting.",
		});
	}

	return insights;
}

// Helper: Generate human-readable skill insights
function generateSkillInsights(skills, totalApps) {
	const insights = [];

	if (skills.length === 0) {
		insights.push({
			level: "info",
			message: "You match all required skills in your applications!",
		});
		return insights;
	}

	const topSkill = skills[0];
	if (topSkill.frequency > totalApps * 0.5) {
		insights.push({
			level: "warning",
			message: `${topSkill.skill} is missing from over 50% of jobs. Consider upskilling here.`,
		});
	}

	if (skills.length > 1) {
		const skillGap =
			((skills[0].frequency - skills[skills.length - 1].frequency) /
				skills[0].frequency) *
			100;
		if (skillGap > 50) {
			insights.push({
				level: "info",
				message: `Your skill gaps vary widely (${skillGap.toFixed(0)}%). Focus on the top skill first.`,
			});
		}
	}

	return insights;
}

// Helper: Generate comprehensive dashboard insights
function generateDashboardInsights(
	totalApps,
	thisWeekApps,
	metrics,
	skills,
	weeklyData
) {
	const insights = [];

	if (totalApps === 0) {
		insights.push({
			level: "info",
			message: "Welcome! Start your job search by analyzing positions.",
		});
		return insights;
	}

	// Activity level
	if (thisWeekApps >= 3) {
		insights.push({
			level: "positive",
			message: `You're on pace! ${thisWeekApps} applications this week.`,
		});
	} else if (thisWeekApps === 0) {
		insights.push({
			level: "info",
			message:
				"No applications this week yet. Keep the momentum going!",
		});
	}

	// Conversion trend
	if (metrics.interviewRate > 10) {
		insights.push({
			level: "positive",
			message: `Strong ${metrics.interviewRate}% interview rate.`,
		});
	}

	// Top skill gap
	if (skills.length > 0) {
		const skill = skills[0];
		insights.push({
			level: "suggestion",
			message: `Most jobs need ${skill._id}. Upskilling here could boost your match rate.`,
		});
	}

	return insights;
}

module.exports = router;
