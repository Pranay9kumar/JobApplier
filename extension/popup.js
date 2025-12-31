// Popup logic is user-driven only: clicks trigger requests to the active tab and backend.

document.addEventListener("DOMContentLoaded", () => {
	const analyzeBtn = document.getElementById("analyzeBtn");
	const prepareBtn = document.getElementById("prepareBtn");
	const matchValue = document.getElementById("matchValue");
	const matchBar = document.getElementById("matchBar");
	const statusLabel = document.getElementById("statusLabel");
	const chips = document.getElementById("signalChips");
	const scoreCard = document.getElementById("scoreCard");
	const skeletonLoader = document.getElementById("skeletonLoader");
	const warningsSection = document.getElementById("warningsSection");
	const warningsList = document.getElementById("warningsList");

	// API Configuration - update after backend deployment
	// For production: https://your-api-domain.com
	// For development: http://localhost:4000
	const DEFAULT_API_BASE = "http://localhost:4000"; // CHANGE THIS TO YOUR PRODUCTION API URL
	const state = {
		loading: false,
		error: null,
		score: null,
		role: "—",
		location: "—",
		skills: [],
		explanation: null,
		expanded: false,
	};

	const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

	// Toast notification system
	const showToast = (message, type = "success", duration = 3000) => {
		const container = document.getElementById("toastContainer");
		const toast = document.createElement("div");
		toast.className = `toast ${type}`;
		toast.innerHTML = `
			<div class="toast-icon">${type === "success" ? "✓" : type === "warning" ? "⚠" : "✕"}</div>
			<div class="toast-message">${message}</div>
		`;
		container.appendChild(toast);

		setTimeout(() => {
			toast.classList.add("removing");
			setTimeout(() => toast.remove(), 200);
		}, duration);
	};

	// Show warnings from autofill
	const showWarnings = (warnings = []) => {
		if (!warnings || warnings.length === 0) {
			warningsSection.style.display = "none";
			return;
		}
		warningsSection.style.display = "block";
		warningsList.innerHTML = warnings
			.map((w) => `<div class="warning-item">${w}</div>`)
			.join("");
	};

	const render = () => {
		const hasScore = typeof state.score === "number";

		// Show/hide skeleton and score card
		skeletonLoader.style.display = state.loading && !hasScore ? "block" : "none";
		scoreCard.style.display = !state.loading || hasScore ? "block" : "none";

		if (hasScore) {
			const value = clamp(state.score, 0, 100);
			matchValue.textContent = value;
			matchBar.style.width = `${value}%`;
			matchBar.style.opacity = 1;
			statusLabel.textContent = value >= 70 ? "Strong match" : value >= 40 ? "Moderate match" : "Low match";

			// Apply card styling based on match level
			scoreCard.classList.remove("match-high", "match-medium", "match-low");
			if (value >= 70) scoreCard.classList.add("match-high");
			else if (value >= 40) scoreCard.classList.add("match-medium");
			else scoreCard.classList.add("match-low");
		} else {
			matchValue.textContent = "--";
			matchBar.style.width = "0%";
			matchBar.style.opacity = 0.4;
			statusLabel.textContent = state.error ? `Error: ${state.error}` : "Awaiting analysis";
			scoreCard.classList.remove("match-high", "match-medium", "match-low");
		}

		const skillText = state.skills.length ? state.skills.join(", ") : "—";
		chips.innerHTML = `
			<span class="chip">Role: ${state.role}</span>
			<span class="chip">Location: ${state.location}</span>
			<span class="chip">Key skills: ${skillText}</span>
		`;

		const explanationSection = document.getElementById("aiExplanation");
		const explanationText = document.getElementById("explanationText");
		if (state.explanation) {
			explanationSection.style.display = "block";
			explanationText.textContent = state.explanation;
			if (state.loading) {
				explanationText.textContent = "Analyzing your match...";
				explanationText.style.opacity = "0.6";
			} else {
				explanationText.style.opacity = "1";
			}
		} else {
			explanationSection.style.display = "none";
		}
	};

	const setStatus = (text) => {
		statusLabel.textContent = text;
	};

	const setLoading = (flag, message) => {
		state.loading = flag;
		analyzeBtn.disabled = flag;
		prepareBtn.disabled = flag;
		if (message) setStatus(message);
		render();
	};

	const getActiveTabId = () => {
		return new Promise((resolve, reject) => {
			if (!chrome?.tabs?.query) {
				reject(new Error("tabs API unavailable; add 'tabs' permission"));
				return;
			}
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const tabId = tabs?.[0]?.id;
				tabId ? resolve(tabId) : reject(new Error("No active tab"));
			});
		});
	};

	const requestJobDescription = async () => {
		const tabId = await getActiveTabId();
		return new Promise((resolve, reject) => {
			try {
				chrome.tabs.sendMessage(
					tabId,
					{ type: "get-job-description" },
					(response) => {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}
						if (!response?.jobDescription) {
							reject(new Error("No job description returned"));
							return;
						}
						resolve(response);
					}
				);
			} catch (err) {
				reject(err);
			}
		});
	};

	const getApiBase = () => {
		return new Promise((resolve) => {
			try {
				chrome.storage?.sync?.get({ apiBase: DEFAULT_API_BASE }, ({ apiBase }) => resolve(apiBase));
			} catch (err) {
				resolve(DEFAULT_API_BASE);
			}
		});
	};

	const getUserToken = () => {
		return new Promise((resolve) => {
			try {
				chrome.storage?.sync?.get({ userToken: null }, ({ userToken }) => resolve(userToken));
			} catch (err) {
				resolve(null);
			}
		});
	};

	const fetchMatchScore = async ({ jobDescription, role, location, skills }) => {
		const apiBase = await getApiBase();
		const url = `${apiBase.replace(/\/$/, "")}/api/match`;
		const payload = { jobDescription, role, location, skills };
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
		return res.json();
	};

	const handleAnalyze = async () => {
		if (state.loading) return;
		setLoading(true, "Requesting job details...");
		state.error = null;
		state.explanation = null;
		render();

		try {
			const job = await requestJobDescription();
			const apiBase = await getApiBase();
			const token = await getUserToken();

			state.role = job.role || job.jobTitle || "—";
			state.location = job.location || "—";
			state.skills = Array.isArray(job.skills) ? job.skills : [];

			if (token) {
				setStatus("Analyzing match...");
				render();

				try {
					const url = `${apiBase.replace(/\/$/, "")}/api/ai/explain-match`;
					const res = await fetch(url, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${token}`,
						},
						body: JSON.stringify({ jobDescription: job.jobDescription }),
					});

					if (!res.ok) {
						throw new Error(`Backend error: ${res.status}`);
					}

					const result = await res.json();
					
					// Extract explanation from structured response
					if (result.data && result.data.explanation) {
						state.explanation = result.data.explanation;
						state.score = result.data.score || null;
						if (Array.isArray(result.data.matchedSkills) && result.data.matchedSkills.length > 0) {
							state.skills = result.data.matchedSkills;
						}
					} else if (result.explanation) {
						state.explanation = result.explanation;
						state.score = result.score || null;
						if (Array.isArray(result.matchedSkills) && result.matchedSkills.length > 0) {
							state.skills = result.matchedSkills;
						}
					}

					setStatus(state.score >= 70 ? "Strong match!" : state.score >= 40 ? "Moderate match" : "Low match");
				} catch (err) {
					console.warn("AI analysis failed", err);
					state.error = "Analysis failed (check connection)";
					state.score = null;
					state.explanation = null;
					setStatus("Analysis unavailable");
				}
			} else {
				setStatus("Login for AI analysis");
				state.score = null;
				state.explanation = null;
			}

			render();
		} catch (err) {
			console.warn("Analysis failed", err);
			state.error = err?.message || "Could not analyze";
			state.score = null;
			state.explanation = null;
			setStatus(state.error);
			render();
		} finally {
			setLoading(false);
		}
	};

	const handlePrepare = async () => {
		if (state.loading) return;
		setLoading(true, "Preparing application...");

		try {
			const tabId = await getActiveTabId();
			const result = await new Promise((resolve, reject) => {
				try {
					chrome.tabs.sendMessage(
						tabId,
						{ type: "autofill-form" },
						(response) => {
							if (chrome.runtime.lastError) {
								reject(new Error(chrome.runtime.lastError.message));
								return;
							}
							resolve(response || {});
						}
					);
				} catch (err) {
					reject(err);
				}
			});

			// Process autofill results
			const { filled = 0, skipped = 0, captcha = false, warnings = [] } = result;

			if (captcha) {
				showToast("CAPTCHA detected — please solve manually", "warning", 4000);
				showWarnings(["CAPTCHA detected on this form"]);
			} else if (filled > 0) {
				showToast(`✓ Filled ${filled} field(s)`, "success");
				if (skipped > 0) {
					showWarnings([`${skipped} field(s) skipped (hidden or unsupported)`]);
					showToast(`${skipped} field(s) skipped`, "warning", 3000);
				}
				setStatus("Review and submit manually");
			} else if (skipped > 0) {
				showToast("No visible fields to fill", "warning");
				showWarnings(["All form fields are hidden or not supported"]);
				setStatus("No visible fields found");
			} else {
				showToast("No form found on this page", "warning");
				setStatus("Could not locate application form");
			}
		} catch (err) {
			console.warn("Autofill failed", err);
			showToast("Autofill failed — try manually", "error");
			setStatus("Autofill error");
		} finally {
			setLoading(false);
		}
	};

	// Keyboard shortcuts
	document.addEventListener("keydown", (e) => {
		// Alt+A for Analyze
		if (e.altKey && e.key.toLowerCase() === "a") {
			e.preventDefault();
			if (!analyzeBtn.disabled) {
				handleAnalyze();
			}
		}
		// Alt+P for Prepare
		if (e.altKey && e.key.toLowerCase() === "p") {
			e.preventDefault();
			if (!prepareBtn.disabled) {
				handlePrepare();
			}
		}
	});

	analyzeBtn?.addEventListener("click", handleAnalyze);
	prepareBtn?.addEventListener("click", handlePrepare);

	// Click on explanation to toggle expanded mode
	scoreCard?.addEventListener("click", (e) => {
		if (e.target.closest(".explanation")) {
			state.expanded = !state.expanded;
			scoreCard.classList.toggle("expanded", state.expanded);
		}
	});

	render();
});
