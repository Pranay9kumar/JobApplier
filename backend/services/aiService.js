// aiService.js
// Lightweight, rule-abiding analysis and remodeling helpers.

const KNOWN_SKILLS = [
	"javascript",
	"typescript",
	"node",
	"react",
	"vue",
	"angular",
	"express",
	"mongo",
	"mongodb",
	"sql",
	"postgres",
	"mysql",
	"python",
	"django",
	"flask",
	"java",
	"c#",
	"go",
	"ruby",
	"php",
	"aws",
	"gcp",
	"azure",
	"docker",
	"kubernetes",
	"terraform",
	"ci",
	"cd",
	"git",
	"testing",
	"jest",
	"cypress",
	"playwright",
	"html",
	"css",
	"sass",
	"less",
	"graphql",
	"rest",
];

const normalize = (text) => (text || "").toLowerCase();
const uniq = (arr = []) => Array.from(new Set(arr));

// Chat-ready response formatter for future conversational UI
const formatAIResponse = (type, data, message = "") => {
	return {
		type, // 'analysis', 'explanation', 'remodel', 'suggestion'
		message, // Short human-readable summary
		data, // Structured payload
		timestamp: new Date().toISOString(),
		suggestedActions: [], // Populated by caller for next steps
		context: {}, // Additional metadata for chat continuity
	};
};

const extractJobSkills = (jobDescription) => {
	const text = normalize(jobDescription);
	const found = new Set();
	for (const skill of KNOWN_SKILLS) {
		if (text.includes(skill)) {
			found.add(skill);
		}
	}
	return Array.from(found);
};

const computeScore = (jobSkills, resumeSkills) => {
	if (!jobSkills.length || !resumeSkills.length) return 0;
	const jobSet = new Set(jobSkills.map(normalize));
	const resumeSet = new Set(resumeSkills.map(normalize));
	let matched = 0;
	for (const skill of jobSet) {
		if (resumeSet.has(skill)) matched += 1;
	}
	const score = Math.round((matched / jobSet.size) * 100);
	return Math.max(0, Math.min(100, score));
};

function analyzeJob(jobDescription, resume) {
	const jobSkills = extractJobSkills(jobDescription);
	const resumeSkills = Array.isArray(resume?.originalParsedSkills) ? resume.originalParsedSkills : [];
	const normalizedResume = resumeSkills.map(normalize);
	const matchedSkills = jobSkills.filter((s) => normalizedResume.includes(normalize(s)));
	const missingSkills = jobSkills.filter((s) => !normalizedResume.includes(normalize(s)));
	const score = computeScore(jobSkills, resumeSkills);

	const suggestions = [];
	if (score >= 70) {
		suggestions.push("Tailor your resume for this job", "Prepare application answers");
	} else if (score >= 40) {
		suggestions.push("Highlight relevant experience", "Address missing skills in cover letter");
	} else if (missingSkills.length > 0) {
		suggestions.push("Consider upskilling in key areas", "Look for better-matched roles");
	}

	return formatAIResponse(
		"analysis",
		{
			score,
			matchedSkills: uniq(matchedSkills),
			missingSkills: uniq(missingSkills),
			jobSkills: uniq(jobSkills),
			resumeSkills: uniq(resumeSkills),
		},
		`Match score: ${score}%. Found ${matchedSkills.length} matching skills.`,
		{
			suggestedActions: suggestions,
			context: { hasResume: true, analysisType: "skill-overlap" },
		}
	);
}

function remodelResume(resume, jobDescription = "") {
	// Rewrites using ONLY existing resume data; no fabrication.
	const summary = (resume?.summary || "").trim();
	const originalSkills = Array.isArray(resume?.parsedSkills) ? uniq(resume.parsedSkills) : [];
	const skills = [...originalSkills];
	const exp = Array.isArray(resume?.parsedExperience) ? resume.parsedExperience : [];
	const jobSkills = extractJobSkills(jobDescription);

	// Track changes for diff
	const changes = {
		skillsReordered: false,
		skillsHighlighted: [],
		experienceReordered: false,
		sectionsReordered: [],
		bulletChanges: [],
	};

	// Simple, ATS-friendly ordering: summary -> skills (job-ordered) -> experience.
	const orderedSkills = jobSkills.length
		? skills.sort((a, b) => {
			const ai = jobSkills.findIndex((s) => normalize(s) === normalize(a));
			const bi = jobSkills.findIndex((s) => normalize(s) === normalize(b));
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		})
		: skills;

	// Check if skills were reordered
	if (JSON.stringify(orderedSkills) !== JSON.stringify(originalSkills)) {
		changes.skillsReordered = true;
		// Track which skills were moved to top (matched job skills)
		changes.skillsHighlighted = jobSkills.filter((s) => 
			orderedSkills.map(normalize).includes(normalize(s))
		);
	}

	const experience = exp.map((role, idx) => ({
		title: role.title || "",
		company: role.company || "",
		startDate: role.startDate || "",
		endDate: role.endDate || "",
		bullets: Array.isArray(role.bullets) ? role.bullets.slice(0, 10) : [],
		originalIndex: idx,
	}));

	// Track section order changes
	if (jobSkills.length > 0) {
		changes.sectionsReordered = ["summary", "skills (job-prioritized)", "experience"];
	} else {
		changes.sectionsReordered = ["summary", "skills", "experience"];
	}

	// Create diff structure
	const diff = {
		skillsChanges: {
			original: originalSkills,
			remodeled: orderedSkills,
			reordered: changes.skillsReordered,
			highlighted: changes.skillsHighlighted,
			added: [], // Never add new skills
			removed: [], // Never remove existing skills
		},
		experienceChanges: {
			reordered: false, // We don't reorder experience in current implementation
			bulletChanges: [], // Track if we reword any bullets (not implemented yet - no fabrication)
		},
		sectionsOrder: {
			original: ["summary", "skills", "experience"],
			remodeled: changes.sectionsReordered,
		},
		summary: generateChangeSummary(changes),
	};

	return formatAIResponse(
		"remodel",
		{
			original: {
				summary,
				skills: originalSkills,
				experience: exp.map((role) => ({
					title: role.title || "",
					company: role.company || "",
					startDate: role.startDate || "",
					endDate: role.endDate || "",
					bullets: Array.isArray(role.bullets) ? role.bullets : [],
				})),
			},
			remodeled: {
				summary,
				skills: orderedSkills,
				experience,
			},
			diff,
			originalExcerpt: (resume?.originalText || "").substring(0, 2000),
		},
		"Resume reordered for ATS optimization using existing data only.",
		{
			suggestedActions: ["Download tailored resume", "Review before applying"],
			context: { 
				jobSkillsCount: jobSkills.length, 
				reorderedSkills: changes.skillsReordered,
				changesMade: diff.summary,
			},
		}
	);
}

function generateChangeSummary(changes) {
	const parts = [];
	if (changes.skillsReordered) {
		parts.push(`Prioritized ${changes.skillsHighlighted.length} job-relevant skills`);
	}
	if (changes.sectionsReordered.length > 0) {
		parts.push("Reordered sections for ATS optimization");
	}
	if (parts.length === 0) {
		return "No changes needed - resume already optimized";
	}
	return parts.join("; ");
}

function refineApplicationAnswers(answers = {}, jobDescription = "") {
	// Refines ordering and trims whitespace; does not add new content.
	const jobSkills = extractJobSkills(jobDescription);
	const normalizedJobSkills = jobSkills.map(normalize);

	const refined = {};
	const keys = Object.keys(answers || {});
	keys.forEach((key) => {
		const val = typeof answers[key] === "string" ? answers[key].trim() : answers[key];
		refined[key] = val;
	});

	// Rank answers that mention job skills higher for consumers that want ordering
	const orderedKeys = keys.sort((a, b) => {
		const aval = normalize(refined[a] || "");
		const bval = normalize(refined[b] || "");
		const aScore = normalizedJobSkills.some((s) => aval.includes(s)) ? 1 : 0;
		const bScore = normalizedJobSkills.some((s) => bval.includes(s)) ? 1 : 0;
		return bScore - aScore;
	});

	return {
		orderedKeys,
		answers: refined,
		jobSkills,
		note: "Answers are trimmed and reordered by overlap with job skills; no new answers or claims added.",
	};
}

function explainMatch(jobDescription, resume) {
	// Generates a friendly explanation using ONLY existing resume data.
	const analysis = analyzeJob(jobDescription, resume);
	const { data } = analysis;
	const { score, matchedSkills, missingSkills } = data;

	const parts = [];

	if (score >= 70) {
		parts.push("Great match! Your resume aligns well with this position.");
	} else if (score >= 40) {
		parts.push("Moderate match. You have some relevant skills for this role.");
	} else {
		parts.push("Limited match based on the skills detected.");
	}

	if (matchedSkills.length > 0) {
		parts.push(`Your resume shows experience with: ${matchedSkills.join(", ")}.`);
	}

	if (missingSkills.length > 0 && missingSkills.length <= 5) {
		parts.push(`The job mentions: ${missingSkills.join(", ")}, which aren't highlighted in your current resume.`);
	} else if (missingSkills.length > 5) {
		parts.push(`The job mentions several skills (${missingSkills.slice(0, 3).join(", ")}, and more) that aren't currently highlighted.`);
	}

	const exp = Array.isArray(resume?.parsedExperience) ? resume.parsedExperience : [];
	if (exp.length > 0) {
		const titles = exp.map((e) => e.title).filter(Boolean);
		if (titles.length > 0) {
			parts.push(`Based on your background as ${titles[0]}${titles.length > 1 ? " and related roles" : ""}.`);
		}
	}

	const explanation = parts.join(" ");
	const suggestions = [];

	if (score >= 70) {
		suggestions.push("Apply now", "Tailor resume", "Prepare answers");
	} else if (score >= 40) {
		suggestions.push("Strengthen resume", "Highlight transferable skills");
	} else {
		suggestions.push("Explore other roles", "Consider upskilling");
	}

	return formatAIResponse(
		"explanation",
		{
			explanation,
			score,
			matchedSkills,
			missingSkills,
		},
		explanation,
		{
			suggestedActions: suggestions,
			context: {
				hasResume: true,
				useOnlyExistingData: true,
				matchLevel: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
			},
		}
	);
}

function improveAnswer(originalAnswer, jobDescription) {
	// Improves tone and relevance of an application answer.
	// Does NOT add claims not present in the original answer.
	
	if (!originalAnswer || typeof originalAnswer !== "string") {
		return {
			improved: originalAnswer || "",
			confidence: 0,
			changes: [],
			note: "No improvement needed",
		};
	}

	const answer = originalAnswer.trim();
	const jobSkills = extractJobSkills(jobDescription);
	const answerLower = normalize(answer);
	
	let improved = answer;
	const changes = [];
	let confidence = 50; // Base confidence

	// 1. Identify job-relevant keywords already present in the answer
	const mentionedJobSkills = jobSkills.filter((skill) =>
		answerLower.includes(normalize(skill))
	);

	if (mentionedJobSkills.length > 0) {
		confidence += Math.min(20, mentionedJobSkills.length * 5);
	}

	// 2. Reorder sentences to highlight job-relevant content first (no fabrication)
	const sentences = answer.split(/(?<=[.!?])\s+/);
	if (sentences.length > 1) {
		// Find sentences mentioning job skills
		const skillSentences = sentences.filter((s) =>
			mentionedJobSkills.some((skill) => normalize(s).includes(normalize(skill)))
		);
		const otherSentences = sentences.filter(
			(s) => !skillSentences.includes(s)
		);

		if (skillSentences.length > 0 && skillSentences.length < sentences.length) {
			improved = [...skillSentences, ...otherSentences].join(" ");
			changes.push(
				`Reordered sentences to highlight ${mentionedJobSkills.length} job-relevant skill(s) first`
			);
			confidence += 10;
		}
	}

	// 3. Trim unnecessary whitespace and standardize punctuation
	const originalLength = improved.length;
	improved = improved
		.trim()
		.replace(/\s+/g, " ")
		.replace(/([.!?])\s*([a-z])/g, "$1 $2");

	if (improved !== answer) {
		changes.push("Cleaned up formatting and spacing");
	}

	// 4. Assess confidence based on job relevance
	if (mentionedJobSkills.length === 0) {
		confidence = Math.max(30, confidence - 20);
		changes.push("No job skills mentioned - improvement limited");
	} else if (mentionedJobSkills.length >= 3) {
		confidence = Math.min(95, confidence + 15);
		changes.push("Answer is highly relevant to job description");
	}

	// Ensure improved answer contains only existing claims
	const originalWords = new Set(normalize(answer).split(/\s+/));
	const improvedWords = new Set(normalize(improved).split(/\s+/));
	const allWordsExist = Array.from(improvedWords).every((word) => {
		// Allow punctuation differences
		return word.length < 2 || originalWords.has(word);
	});

	if (!allWordsExist) {
		// Safety check: revert if words were added
		improved = answer;
		confidence = Math.max(20, confidence - 30);
		changes.push("Safety check: minimal modification applied");
	}

	if (changes.length === 0) {
		changes.push("Answer is already well-optimized");
		confidence = Math.min(100, confidence + 10);
	}

	return formatAIResponse(
		"improvement",
		{
			original: answer,
			improved,
			mentionedJobSkills,
			confidence: Math.max(0, Math.min(100, confidence)),
			changes,
			note: "Tone and relevance improved without adding new claims",
		},
		`Answer improved. Confidence: ${confidence}%`,
		{
			suggestedActions: ["Review improved version", "Use improved answer", "Keep original"],
			context: {
				usedExistingDataOnly: true,
				jobSkillsMentioned: mentionedJobSkills.length,
				improvementType: "tone-and-relevance",
			},
		}
	);
}

function calculateSkillMatch(jobDescription, resumeSkills) {
	// Returns skill match score (0-100) based on overlap with job requirements
	if (!jobDescription || !resumeSkills || resumeSkills.length === 0) return 0;

	const jobSkills = extractJobSkills(jobDescription);
	if (jobSkills.length === 0) return 50; // No skills mentioned in job = neutral

	const matchedSkills = jobSkills.filter((skill) =>
		resumeSkills.some((userSkill) => normalize(userSkill).includes(normalize(skill)) || normalize(skill).includes(normalize(userSkill)))
	);

	return Math.round((matchedSkills.length / jobSkills.length) * 100);
}

function calculateExperienceFit(jobDescription, yearsOfExperience = 0) {
	// Returns experience fit score (0-100) based on years required vs user's years
	// Extracts years from job description using patterns like "X years of"
	const yearMatch = jobDescription.match(/(\d+)\+?\s*years?\s+of\s+experience/i);
	const requiredYears = yearMatch ? parseInt(yearMatch[1]) : 0;

	if (requiredYears === 0) return 75; // No requirement specified = neutral-positive

	// Score: 100 if user meets requirement, decrement for each year below, cap at 0
	if (yearsOfExperience >= requiredYears) return 100;
	if (yearsOfExperience >= requiredYears - 1) return 85;
	if (yearsOfExperience >= requiredYears - 2) return 70;
	return Math.max(30, 100 - (requiredYears - yearsOfExperience) * 15);
}

function calculateLocationMatch(jobLocation, userLocation) {
	// Returns location match score (0-100)
	// 100: exact match (same city/state), 70: same state, 40: same country, 0: remote preferred, 30: different countries
	if (!jobLocation || !userLocation) return 50; // Unknown = neutral

	const jobLoc = normalize(jobLocation);
	const userLoc = normalize(userLocation);

	if (jobLoc.includes("remote") || userLoc.includes("remote")) return 80;
	if (jobLoc === userLoc) return 100;
	if (jobLoc.split(",")[0] === userLoc.split(",")[0]) return 100; // Same city
	if (jobLoc.split(",")[1] === userLoc.split(",")[1]) return 70; // Same state/country part
	return 40; // Different location
}

function calculateRecency(jobPostedDate) {
	// Returns recency score (0-100) based on days since posting
	// Newer = higher score. Older than 90 days = lower score
	if (!jobPostedDate) return 50; // Unknown = neutral

	const posted = new Date(jobPostedDate);
	const now = new Date();
	const daysSincePosted = Math.floor((now - posted) / (1000 * 60 * 60 * 24));

	if (daysSincePosted <= 7) return 100;
	if (daysSincePosted <= 30) return 85;
	if (daysSincePosted <= 60) return 70;
	if (daysSincePosted <= 90) return 50;
	return Math.max(20, 100 - daysSincePosted / 3); // Decline slowly after 90 days
}

function rankJobs(jobs = [], userResume = {}, userLocation = "", customWeights = {}) {
	// Ranks jobs based on skill match, experience fit, location, and recency.
	// Returns ranked jobs with detailed scoring breakdown and explanations.
	// 
	// Params:
	//   jobs: Array of job objects with title, description, location, postedDate
	//   userResume: Resume object with parsedSkills and yearsOfExperience
	//   userLocation: User's location string for matching
	//   customWeights: Optional { skillMatch, experienceFit, location, recency }
	//
	// Example weights: { skillMatch: 0.4, experienceFit: 0.25, location: 0.2, recency: 0.15 }

	if (!jobs || jobs.length === 0) return [];

	// Default weights (can be overridden)
	const weights = {
		skillMatch: 0.4,
		experienceFit: 0.25,
		location: 0.2,
		recency: 0.15,
		...customWeights,
	};

	// Normalize weights to sum to 1.0
	const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
	const normalizedWeights = Object.keys(weights).reduce((acc, key) => {
		acc[key] = weights[key] / weightSum;
		return acc;
	}, {});

	const resumeSkills = userResume.parsedSkills || [];
	const yearsOfExp = userResume.yearsOfExperience || 0;

	// Score each job
	const rankedJobs = jobs
		.map((job) => {
			const skillScore = calculateSkillMatch(job.description || "", resumeSkills);
			const expScore = calculateExperienceFit(job.description || "", yearsOfExp);
			const locScore = calculateLocationMatch(job.location || "", userLocation);
			const recScore = calculateRecency(job.postedDate);

			// Combined weighted score
			const totalScore = Math.round(
				skillScore * normalizedWeights.skillMatch +
					expScore * normalizedWeights.experienceFit +
					locScore * normalizedWeights.location +
					recScore * normalizedWeights.recency
			);

			// Build explanation
			const explanations = [];
			if (skillScore >= 80)
				explanations.push(`Strong skill match (${skillScore}% of job skills found in your resume)`);
			else if (skillScore >= 60) explanations.push(`Good skill match (${skillScore}% of job skills)`);
			else if (skillScore >= 40) explanations.push(`Some relevant skills (${skillScore}%)`);
			else explanations.push(`Limited skill overlap (${skillScore}%)`);

			if (expScore >= 90)
				explanations.push("Your experience meets or exceeds job requirements");
			else if (expScore >= 70) explanations.push("Your experience is close to job requirements");
			else explanations.push(`Experience gap of ${Math.abs(yearsOfExp - (job.description.match(/(\d+)\+?\s*years?/) ? parseInt(job.description.match(/(\d+)\+?\s*years?/)[1]) : 0))} years`);

			if (locScore === 100) explanations.push("Perfect location match");
			else if (locScore >= 70) explanations.push("Good location fit");
			else if (locScore >= 40) explanations.push("Location may require relocation");

			if (recScore >= 85) explanations.push("Recently posted - high priority");
			else if (recScore < 40)
				explanations.push(
					`Posted ${Math.floor((new Date() - new Date(job.postedDate)) / (1000 * 60 * 60 * 24))} days ago`
				);

			const explanation = explanations.join(" • ");

			return {
				...job,
				rankingScore: totalScore,
				scoreBreakdown: {
					skillMatch: skillScore,
					experienceFit: expScore,
					location: locScore,
					recency: recScore,
				},
				weights: normalizedWeights,
				explanation,
				rank: 0, // Will be set after sorting
			};
		})
		.sort((a, b) => b.rankingScore - a.rankingScore)
		.map((job, index) => ({
			...job,
			rank: index + 1,
		}));

	return rankedJobs;
}

module.exports = {
	analyzeJob,
	remodelResume,
	refineApplicationAnswers,
	explainMatch,
	improveAnswer,
	rankJobs,
	calculateSkillMatch,
	calculateExperienceFit,
	calculateLocationMatch,
	calculateRecency,
	formatAIResponse,
};
