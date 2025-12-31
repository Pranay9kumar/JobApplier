const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const AnswerVersionSchema = new mongoose.Schema(
	{
		versionId: { type: String, required: true },
		text: { type: String, required: true },
		isAIImproved: { type: Boolean, default: false },
		originalVersionId: { type: String, default: null }, // For rollback to pre-AI version
		usageCount: { type: Number, default: 0 },
		lastUsed: { type: Date, default: null },
	},
	{ timestamps: true }
);

const ApplicationAnswerSchema = new mongoose.Schema(
	{
		question: { type: String, required: true },
		versions: { type: [AnswerVersionSchema], default: [] },
		activeVersionId: { type: String, default: null },
	},
	{ _id: false }
);

const UserSchema = new mongoose.Schema(
	{
		name: { type: String, trim: true },
		email: { type: String, required: true, unique: true, lowercase: true, trim: true },
		passwordHash: { type: String, required: true, select: false },
		resume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", default: null },
		applicationAnswers: { type: [ApplicationAnswerSchema], default: [] },
	},
	{ timestamps: true }
);

UserSchema.methods.comparePassword = function comparePassword(candidate) {
	return bcrypt.compare(candidate, this.passwordHash);
};

UserSchema.statics.hashPassword = function hashPassword(rawPassword) {
	const SALT_ROUNDS = 10;
	return bcrypt.hash(rawPassword, SALT_ROUNDS);
};

UserSchema.set("toJSON", {
	transform: (_doc, ret) => {
		delete ret.passwordHash;
		return ret;
	},
});

// Helper methods for managing application answers

// Get active answer for a question
UserSchema.methods.getAnswer = function (question) {
	const answerDoc = this.applicationAnswers.find((a) => a.question === question);
	if (!answerDoc || !answerDoc.activeVersionId) return null;
	const version = answerDoc.versions.find((v) => v.versionId === answerDoc.activeVersionId);
	return version || null;
};

// Add or update an answer version
UserSchema.methods.setAnswer = function (question, text, isAIImproved = false, originalVersionId = null) {
	const versionId = `v${Date.now()}`;
	let answerDoc = this.applicationAnswers.find((a) => a.question === question);
	
	if (!answerDoc) {
		answerDoc = { question, versions: [], activeVersionId: versionId };
		this.applicationAnswers.push(answerDoc);
	}
	
	answerDoc.versions.push({
		versionId,
		text,
		isAIImproved,
		originalVersionId,
		usageCount: 0,
		lastUsed: null,
	});
	answerDoc.activeVersionId = versionId;
	
	return versionId;
};

// Rollback to original (non-AI) version
UserSchema.methods.rollbackAnswer = function (question) {
	const answerDoc = this.applicationAnswers.find((a) => a.question === question);
	if (!answerDoc || !answerDoc.activeVersionId) return false;
	
	const activeVersion = answerDoc.versions.find((v) => v.versionId === answerDoc.activeVersionId);
	if (!activeVersion || !activeVersion.isAIImproved || !activeVersion.originalVersionId) return false;
	
	// Switch back to original version
	answerDoc.activeVersionId = activeVersion.originalVersionId;
	return true;
};

// Track usage of an answer
UserSchema.methods.trackAnswerUsage = function (question) {
	const answerDoc = this.applicationAnswers.find((a) => a.question === question);
	if (!answerDoc || !answerDoc.activeVersionId) return false;
	
	const version = answerDoc.versions.find((v) => v.versionId === answerDoc.activeVersionId);
	if (!version) return false;
	
	version.usageCount += 1;
	version.lastUsed = new Date();
	return true;
};

module.exports = mongoose.model("User", UserSchema);
