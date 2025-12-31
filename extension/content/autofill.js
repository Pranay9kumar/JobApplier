// autofill.js: Fills application forms with user profile data.
// Activated ONLY after user clicks "Prepare Application" in the popup.
// Does NOT auto-submit. Stops if CAPTCHA is detected.

(function () {
	"use strict";

	// Field mapping: common input names/IDs to profile keys
	const FIELD_MAPPINGS = {
		// Personal info
		firstName: ["firstName", "first_name", "first-name", "fname", "givenName"],
		lastName: ["lastName", "last_name", "last-name", "lname", "familyName", "surname"],
		fullName: ["name", "full_name", "fullName", "full-name", "applicant_name"],
		email: ["email", "e-mail", "emailAddress", "email_address"],
		phone: ["phone", "telephone", "phoneNumber", "phone_number", "mobile", "cell"],
		// Location
		city: ["city", "town"],
		state: ["state", "province", "region"],
		country: ["country", "nationality"],
		postalCode: ["zip", "zipCode", "postalCode", "postal_code", "postcode"],
		// Professional
		linkedin: ["linkedin", "linkedIn", "linkedin_url", "linkedinUrl"],
		portfolio: ["portfolio", "website", "portfolioUrl", "personal_website"],
		github: ["github", "githubUrl", "github_url"],
		// Employment
		currentCompany: ["current_company", "currentCompany", "employer"],
		currentTitle: ["current_title", "currentTitle", "jobTitle", "position"],
		yearsExperience: ["years_experience", "yearsExperience", "experience", "yoe"],
		// Application specific
		salaryExpectation: ["salary", "salary_expectation", "salaryExpectation", "expected_salary"],
		noticePeriod: ["notice", "notice_period", "noticePeriod", "availability"],
		willingToRelocate: ["relocate", "relocation", "willing_to_relocate"],
		workAuthorization: ["work_authorization", "workAuthorization", "visa_status", "authorization"],
	};

	const isVisible = (element) => {
		if (!element) return false;
		const style = window.getComputedStyle(element);
		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			style.opacity !== "0" &&
			!element.hasAttribute("hidden") &&
			element.offsetWidth > 0 &&
			element.offsetHeight > 0 &&
			!element.disabled &&
			!element.readOnly
		);
	};

	const matchesAnyPattern = (str, patterns) => {
		if (!str) return false;
		const normalized = str.toLowerCase().replace(/[_-]/g, "");
		return patterns.some((pattern) => {
			const normalizedPattern = pattern.toLowerCase().replace(/[_-]/g, "");
			return normalized.includes(normalizedPattern) || normalizedPattern.includes(normalized);
		});
	};

	const getFieldType = (element) => {
		const name = element.name || "";
		const id = element.id || "";
		const placeholder = element.placeholder || "";
		const ariaLabel = element.getAttribute("aria-label") || "";
		const label = findLabelText(element);

		const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${label}`;

		for (const [fieldType, patterns] of Object.entries(FIELD_MAPPINGS)) {
			if (matchesAnyPattern(combined, patterns)) {
				return fieldType;
			}
		}
		return null;
	};

	const findLabelText = (element) => {
		// Try to find associated label
		if (element.id) {
			const label = document.querySelector(`label[for="${element.id}"]`);
			if (label) return label.innerText;
		}
		// Check if wrapped in label
		const parentLabel = element.closest("label");
		if (parentLabel) return parentLabel.innerText;
		return "";
	};

	const fillField = (element, value) => {
		if (!element || !isVisible(element) || value === undefined || value === null) return false;

		try {
			if (element.tagName === "SELECT") {
				// Try to match option by value or text
				const options = Array.from(element.options);
				const match = options.find(
					(opt) => opt.value === value || opt.text.toLowerCase().includes(value.toString().toLowerCase())
				);
				if (match) {
					element.value = match.value;
					element.dispatchEvent(new Event("change", { bubbles: true }));
					return true;
				}
			} else if (element.type === "checkbox" || element.type === "radio") {
				// Handle boolean or "yes/no" values
				const shouldCheck =
					value === true || value === "yes" || value === "Yes" || value === "true" || value === element.value;
				if (shouldCheck) {
					element.checked = true;
					element.dispatchEvent(new Event("change", { bubbles: true }));
					return true;
				}
			} else {
				// Text input, textarea, etc.
				element.value = value;
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("change", { bubbles: true }));
				return true;
			}
		} catch (err) {
			console.warn("[autofill] Failed to fill field:", element, err);
		}
		return false;
	};

	const autofillForm = (profileData) => {
		if (!profileData) {
			console.warn("[autofill] No profile data provided");
			return { filled: 0, skipped: 0, message: "No profile data" };
		}

		// Check for CAPTCHA before proceeding
		if (window.captchaDetector) {
			const captchaResult = window.captchaDetector.detectCaptcha();
			if (captchaResult.detected) {
				console.warn("[autofill] CAPTCHA detected, stopping autofill:", captchaResult);
				return {
					filled: 0,
					skipped: 0,
					captcha: true,
					message: `${captchaResult.type} detected. Please complete it manually.`,
				};
			}
		}

		let filled = 0;
		let skipped = 0;

		// Find all fillable fields
		const fields = document.querySelectorAll("input, textarea, select");

		for (const field of fields) {
			if (!isVisible(field)) {
				continue; // Skip hidden fields
			}

			// NEVER fill hidden anti-bot fields
			if (field.type === "hidden" || field.style.display === "none") {
				continue;
			}

			// Skip submit buttons, reset buttons, and file inputs
			if (["submit", "button", "reset", "file", "image"].includes(field.type)) {
				continue;
			}

			const fieldType = getFieldType(field);
			if (fieldType && profileData[fieldType]) {
				const success = fillField(field, profileData[fieldType]);
				if (success) {
					filled++;
					console.log(`[autofill] Filled ${fieldType}:`, field);
				} else {
					skipped++;
				}
			}
		}

		return {
			filled,
			skipped,
			captcha: false,
			message: `Filled ${filled} field(s). Review before submitting.`,
		};
	};

	// Listen for autofill request from popup
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.type === "autofill-form") {
			try {
				const result = autofillForm(message.profileData);
				sendResponse(result);
			} catch (err) {
				console.error("[autofill] Error:", err);
				sendResponse({
					filled: 0,
					skipped: 0,
					error: err.message,
					message: "Autofill failed",
				});
			}
			return true; // Keep channel open for async response
		}
	});

	console.log("[autofill] Ready to fill forms on user request. No auto-submit.");
})();