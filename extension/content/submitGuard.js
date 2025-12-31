// submitGuard.js: Blocks automated submissions and signals when submit buttons are present.
// Runs in-page; does not store data; allows user-controlled submission only.

(function () {
	"use strict";

	const SUBMIT_SELECTORS = [
		"button[type='submit']",
		"input[type='submit']",
		"button[data-testid*='submit']",
		"button[aria-label*='submit']",
		"button",
		"input[type='button']",
	];

	const isVisible = (el) => {
		if (!el) return false;
		const style = window.getComputedStyle(el);
		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			style.opacity !== "0" &&
			!el.hasAttribute("hidden") &&
			el.offsetWidth > 0 &&
			el.offsetHeight > 0
		);
	};

	const looksLikeSubmit = (el) => {
		if (!el) return false;
		const tag = el.tagName?.toLowerCase();
		const type = (el.getAttribute && el.getAttribute("type")) || "";
		const text = (el.innerText || el.value || "").trim().toLowerCase();
		if (tag === "button" && type === "submit") return true;
		if (tag === "input" && type === "submit") return true;
		return ["submit", "apply", "send application", "send", "continue"].some((word) => text.includes(word));
	};

	let submitVisible = false;

	const detectSubmitPresence = () => {
		for (const selector of SUBMIT_SELECTORS) {
			const candidates = document.querySelectorAll(selector);
			for (const el of candidates) {
				if (isVisible(el) && looksLikeSubmit(el)) {
					submitVisible = true;
					return true;
				}
			}
		}
		submitVisible = false;
		return false;
	};

	const observer = new MutationObserver(() => {
		detectSubmitPresence();
	});

	observer.observe(document.documentElement || document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["style", "class", "type", "hidden"],
	});

	// Block non-user (synthetic) clicks on submit-like elements
	document.addEventListener(
		"click",
		(event) => {
			const target = event.target && (event.target.closest?.("button, input") || event.target);
			if (target && looksLikeSubmit(target)) {
				if (!event.isTrusted) {
					event.preventDefault();
					event.stopImmediatePropagation();
					console.warn("[submitGuard] Blocked automated click on submit control");
				}
			}
		},
		true
	);

	// Block synthetic form submissions
	document.addEventListener(
		"submit",
		(event) => {
			if (!event.isTrusted) {
				event.preventDefault();
				event.stopImmediatePropagation();
				console.warn("[submitGuard] Blocked automated form submission");
			}
		},
		true
	);

	// Respond to status checks from popup or other scripts
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.type === "submit-guard-status") {
			detectSubmitPresence();
			sendResponse({
				submitVisible,
				message: submitVisible
					? "Submit button is visible; automation should pause"
					: "No submit button detected",
			});
			return true;
		}
	});

	// Initial scan
	detectSubmitPresence();
	console.log("[submitGuard] Active. Automation pauses when submit controls are present.");
})();
