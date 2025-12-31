// jobReader.js: Extracts job title and description from the current page.
// Activated ONLY after user clicks "Analyze Job" in the popup.
// Does NOT store data; returns it session-only to the popup.

(function () {
	"use strict";

	// Extract visible text from an element, ignoring hidden or script/style tags
	const getVisibleText = (element) => {
		if (!element) return "";
		const clone = element.cloneNode(true);
		// Remove script, style, and hidden elements
		const unwanted = clone.querySelectorAll("script, style, [hidden], [aria-hidden='true']");
		unwanted.forEach((el) => el.remove());
		return clone.innerText?.trim() || "";
	};

	// Common selectors for job title across popular job sites
	const titleSelectors = [
		"h1",
		"[data-testid='job-title']",
		".job-title",
		".job-details-jobs-unified-top-card__job-title",
		"[class*='jobTitle']",
		"[class*='job-title']",
	];

	// Common selectors for job description across popular job sites
	const descriptionSelectors = [
		"[class*='description']",
		"[class*='job-description']",
		"[id*='job-description']",
		"[data-testid='job-description']",
		".jobs-description",
		"article",
		"main",
	];

	const extractJobTitle = () => {
		for (const selector of titleSelectors) {
			const element = document.querySelector(selector);
			if (element) {
				const text = getVisibleText(element);
				if (text.length > 0 && text.length < 200) {
					return text;
				}
			}
		}
		// Fallback: first h1 on the page
		const fallback = document.querySelector("h1");
		return fallback ? getVisibleText(fallback) : "Unknown Position";
	};

	const extractJobDescription = () => {
		for (const selector of descriptionSelectors) {
			const element = document.querySelector(selector);
			if (element) {
				const text = getVisibleText(element);
				if (text.length > 100) {
					// Likely found the description
					return text;
				}
			}
		}
		// Fallback: body text if nothing else found
		const body = document.querySelector("body");
		return body ? getVisibleText(body).substring(0, 5000) : "No description found";
	};

	// Extract additional metadata if available
	const extractMetadata = () => {
		const metadata = {
			role: null,
			location: null,
			skills: [],
		};

		// Try to extract location
		const locationSelectors = [
			"[class*='location']",
			"[class*='job-location']",
			"[data-testid='job-location']",
		];
		for (const selector of locationSelectors) {
			const element = document.querySelector(selector);
			if (element) {
				const text = getVisibleText(element);
				if (text.length > 0 && text.length < 200) {
					metadata.location = text;
					break;
				}
			}
		}

		return metadata;
	};

	// Listen for messages from the popup
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.type === "get-job-description") {
			try {
				const jobTitle = extractJobTitle();
				const jobDescription = extractJobDescription();
				const metadata = extractMetadata();

				// Return extracted data without storing it anywhere
				sendResponse({
					jobTitle,
					jobDescription,
					role: metadata.role || jobTitle,
					location: metadata.location || "Not specified",
					skills: metadata.skills,
				});
			} catch (err) {
				console.warn("[jobReader] Extraction failed:", err);
				sendResponse({
					error: err.message,
					jobTitle: "Error",
					jobDescription: "Could not extract job details from this page.",
				});
			}
			return true; // Keep channel open for async response
		}
	});

	console.log("[jobReader] Ready to extract job details on user request.");
})();