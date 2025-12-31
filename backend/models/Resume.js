const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema(
	{
		question: { type: String, required: true },
		answer: { type: String, required: true },
	},
	{ _id: false }
);

const ExperienceSchema = new mongoose.Schema(
	{
		title: { type: String },
		company: { type: String },
		startDate: { type: String },
		endDate: { type: String },
		bullets: { type: [String], default: [] },
	},
	{ _id: false }
);

const CustomVersionSchema = new mongoose.Schema(
	{
		versionId: { type: String, required: true }, // Unique version identifier
		jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", index: true },
		jobTitle: { type: String },
		company: { type: String },
		tailoredResume: { type: String, default: "" },
		matchScore: { type: Number },
		aiSummary: { type: String, default: "" }, // AI-generated summary of changes/optimizations
		metadata: {
			appliedChanges: { type: [String], default: [] }, // List of modifications made
			skillsHighlighted: { type: [String], default: [] }, // Skills emphasized in this version
			experienceReordered: { type: Boolean, default: false },
		},
	},
	{ timestamps: true }
);

const ResumeSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		// Raw, user-provided resume data (e.g., uploaded text or parsed PDF/Docx plain text)
		// IMMUTABLE: preserved as the canonical source
		originalText: { type: String, default: "", immutable: true },
		originalParsedSkills: { type: [String], default: [], immutable: true },
		originalParsedExperience: { type: [ExperienceSchema], default: [], immutable: true },
		// Parsed structured data (can be updated by user edits)
		parsedSkills: { type: [String], default: [] },
		parsedExperience: { type: [ExperienceSchema], default: [] },
		// Resume variants tailored per job with full versioning metadata
		customVersions: { type: [CustomVersionSchema], default: [] },
		// Active version tracking
		activeVersionId: { type: String, default: null }, // null = using original
		// Optional summary and Q&A for applications
		summary: { type: String, default: "" },
		answers: { type: [AnswerSchema], default: [] },
	},
	{ timestamps: true }
);

ResumeSchema.set("toJSON", {
	transform: (_doc, ret) => ret,
});

// Helper method to revert to original resume
ResumeSchema.methods.revertToOriginal = function () {
	this.activeVersionId = null;
	this.parsedSkills = [...this.originalParsedSkills];
	this.parsedExperience = [...this.originalParsedExperience];
	return this.save();
};

// Helper method to get active resume content
ResumeSchema.methods.getActiveResume = function () {
	if (!this.activeVersionId) {
		return {
			source: "original",
			skills: this.originalParsedSkills,
			experience: this.originalParsedExperience,
			text: this.originalText,
		};
	}
	const version = this.customVersions.find((v) => v.versionId === this.activeVersionId);
	if (!version) {
		return this.getActiveResume.call({ ...this, activeVersionId: null });
	}
	return {
		source: "custom",
		versionId: version.versionId,
		jobTitle: version.jobTitle,
		company: version.company,
		text: version.tailoredResume,
		matchScore: version.matchScore,
		createdAt: version.createdAt,
	};
};

module.exports = mongoose.model("Resume", ResumeSchema);
