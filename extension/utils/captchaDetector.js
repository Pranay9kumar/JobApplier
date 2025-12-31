// captchaDetector.js: Detects CAPTCHA challenges on the current page.
// Used to pause autofill when human verification is required.

(function () {
	"use strict";

	const CAPTCHA_INDICATORS = {
		// Common CAPTCHA service iframes and containers
		iframes: [
			"iframe[src*='recaptcha']",
			"iframe[src*='hcaptcha']",
			"iframe[src*='captcha']",
			"iframe[title*='recaptcha']",
			"iframe[title*='hcaptcha']",
		],
		// DOM elements that indicate CAPTCHA presence
		elements: [
			".g-recaptcha",
			".h-captcha",
			"[class*='captcha']",
			"[id*='captcha']",
			"[data-sitekey]", // reCAPTCHA/hCaptcha attribute
		],
		// Script sources that load CAPTCHA services
		scripts: [
			"script[src*='recaptcha']",
			"script[src*='hcaptcha']",
			"script[src*='captcha']",
		],
	};

	/**
	 * Checks if the current page contains a CAPTCHA challenge.
	 * @returns {Object} { detected: boolean, type: string|null, message: string }
	 */
	const detectCaptcha = () => {
		const result = {
			detected: false,
			type: null,
			message: "No CAPTCHA detected",
		};

		// Check for CAPTCHA iframes
		for (const selector of CAPTCHA_INDICATORS.iframes) {
			const iframe = document.querySelector(selector);
			if (iframe && isVisible(iframe)) {
				result.detected = true;
				result.type = iframe.src.includes("recaptcha") ? "reCAPTCHA" : iframe.src.includes("hcaptcha") ? "hCAPTCHA" : "CAPTCHA";
				result.message = `${result.type} detected on page`;
				return result;
			}
		}

		// Check for CAPTCHA container elements
		for (const selector of CAPTCHA_INDICATORS.elements) {
			const element = document.querySelector(selector);
			if (element && isVisible(element)) {
				result.detected = true;
				result.type = element.className.includes("recaptcha") ? "reCAPTCHA" : element.className.includes("hcaptcha") ? "hCAPTCHA" : "CAPTCHA";
				result.message = `${result.type} container found`;
				return result;
			}
		}

		// Check for CAPTCHA scripts
		for (const selector of CAPTCHA_INDICATORS.scripts) {
			const script = document.querySelector(selector);
			if (script) {
				result.detected = true;
				result.type = script.src.includes("recaptcha") ? "reCAPTCHA" : script.src.includes("hcaptcha") ? "hCAPTCHA" : "CAPTCHA";
				result.message = `${result.type} script loaded`;
				return result;
			}
		}

		return result;
	};

	/**
	 * Checks if an element is visible to the user.
	 * @param {HTMLElement} element
	 * @returns {boolean}
	 */
	const isVisible = (element) => {
		if (!element) return false;
		const style = window.getComputedStyle(element);
		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			style.opacity !== "0" &&
			element.offsetWidth > 0 &&
			element.offsetHeight > 0
		);
	};

	// Export for use in other scripts
	if (typeof window !== "undefined") {
		window.captchaDetector = { detectCaptcha, isVisible };
	}
})();