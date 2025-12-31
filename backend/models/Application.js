// Application schema: tracks user job applications with status and analytics

const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		job: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Job",
			required: true,
		},
		jobSnapshot: {
			// Store immutable job data at time of application
			title: String,
			company: String,
			location: String,
			description: String,
			source: String,
		},
		appliedAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
		// User-confirmed application status
		status: {
			type: String,
			enum: ["applied", "interviewing", "rejected", "offer", "accepted"],
			default: "applied",
		},
		// When status last changed (for conversion tracking)
		statusUpdatedAt: {
			type: Date,
			default: Date.now,
		},
		// User-provided notes about the application
		notes: {
			type: String,
			maxlength: 2000,
		},
		// Auto-populated: resume used for this application
		resumeVersionUsed: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Resume",
		},
		// Track if application was matched via AI
		aiMatched: {
			type: Boolean,
			default: false,
		},
		// Store match score at time of application for historical tracking
		matchScoreSnapshot: Number,
		matchedSkills: [String],
		missingSkills: [String],
	},
	{
		timestamps: true,
		collection: "applications",
	}
);

// Index for analytics queries
ApplicationSchema.index({ user: 1, appliedAt: 1 });
ApplicationSchema.index({ user: 1, status: 1 });
ApplicationSchema.index({ user: 1, appliedAt: -1, status: 1 });

// Helper method: get applications by week
ApplicationSchema.statics.getApplicationsByWeek = async function (userId, weeks = 8) {
	const now = new Date();
	const startDate = new Date(now);
	startDate.setDate(startDate.getDate() - weeks * 7);

	const result = await this.aggregate([
		{
			$match: {
				user: new mongoose.Types.ObjectId(userId),
				appliedAt: { $gte: startDate },
			},
		},
		{
			$group: {
				_id: {
					year: { $year: "$appliedAt" },
					week: { $week: "$appliedAt" },
				},
				count: { $sum: 1 },
				interviews: {
					$sum: {
						$cond: [
							{
								$in: ["$status", ["interviewing", "offer", "accepted"]],
							},
							1,
							0,
						],
					},
				},
			},
		},
		{
			$sort: { "_id.year": 1, "_id.week": 1 },
		},
	]);

	return result;
};

// Helper method: get status distribution
ApplicationSchema.statics.getStatusDistribution = async function (userId) {
	const result = await this.aggregate([
		{
			$match: {
				user: new mongoose.Types.ObjectId(userId),
			},
		},
		{
			$group: {
				_id: "$status",
				count: { $sum: 1 },
				avgDaysToStatus: {
					$avg: {
						$divide: [
							{
								$subtract: [
									"$statusUpdatedAt",
									"$appliedAt",
								],
							},
							1000 * 60 * 60 * 24, // Convert ms to days
						],
					},
				},
			},
		},
	]);

	return result;
};

// Helper method: get missing skills across applications
ApplicationSchema.statics.getMissingSkillsAnalysis = async function (userId, limit = 10) {
	const result = await this.aggregate([
		{
			$match: {
				user: new mongoose.Types.ObjectId(userId),
				missingSkills: { $exists: true, $ne: [] },
			},
		},
		{
			$unwind: "$missingSkills",
		},
		{
			$group: {
				_id: "$missingSkills",
				count: { $sum: 1 },
				jobsRequiring: { $push: "$jobSnapshot.title" },
			},
		},
		{
			$sort: { count: -1 },
		},
		{
			$limit: limit,
		},
		{
			$project: {
				skill: "$_id",
				frequency: "$count",
				exampleJobs: { $slice: ["$jobsRequiring", 3] },
				_id: 0,
			},
		},
	]);

	return result;
};

// Helper method: calculate conversion rate
ApplicationSchema.statics.getConversionMetrics = async function (userId) {
	const applications = await this.find({
		user: new mongoose.Types.ObjectId(userId),
	}).lean();

	if (applications.length === 0) {
		return {
			totalApplications: 0,
			applied: 0,
			interviewing: 0,
			rejected: 0,
			offers: 0,
			accepted: 0,
			conversionRate: 0,
			interviewRate: 0,
		};
	}

	const stats = {
		totalApplications: applications.length,
		applied: applications.filter((a) => a.status === "applied").length,
		interviewing: applications.filter((a) => a.status === "interviewing").length,
		rejected: applications.filter((a) => a.status === "rejected").length,
		offers: applications.filter((a) => a.status === "offer").length,
		accepted: applications.filter((a) => a.status === "accepted").length,
	};

	// Conversion: offers / total applications
	stats.conversionRate = (
		((stats.offers + stats.accepted) / stats.totalApplications) *
		100
	).toFixed(1);

	// Interview rate: interviewing + offers + accepted / total
	stats.interviewRate = (
		((stats.interviewing + stats.offers + stats.accepted) /
			stats.totalApplications) *
		100
	).toFixed(1);

	return stats;
};

// Helper method: update application status
ApplicationSchema.methods.updateStatus = function (newStatus) {
	if (
		!["applied", "interviewing", "rejected", "offer", "accepted"].includes(
			newStatus
		)
	) {
		throw new Error("Invalid status");
	}
	this.status = newStatus;
	this.statusUpdatedAt = new Date();
	return this.save();
};

module.exports = mongoose.model("Application", ApplicationSchema);
