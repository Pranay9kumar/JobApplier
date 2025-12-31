const mongoose = require("mongoose");

const UserRelevanceSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		score: { type: Number, min: 0, max: 100 },
	},
	{ _id: false }
);

const JobSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		company: { type: String, required: true, trim: true },
		location: { type: String, default: "" },
		description: { type: String, required: true },
		relevance: { type: [UserRelevanceSchema], default: [] },
		source: { type: String, default: "open" }, // Only open sources per README rules
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
