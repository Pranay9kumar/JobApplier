PROJECT NAME:
AI Job Discovery & Application Assistant

REFERENCE UX:
JobRight (UX inspiration only, not code or data copying)

========================
PROJECT GOAL
========================
Build a production-ready website + Chrome Extension that:
- Shows job cards from OPEN sources
- Calculates job relevance using AI
- Provides a resume builder and resume remodeling
- Stores user application answers
- Uses a Chrome extension to assist in job applications
- Autofills application forms to save time
- ALWAYS requires the user to manually submit the final application

This is an ASSISTANT, not an automation bot.

========================
NON-NEGOTIABLE RULES
========================

LEGAL & PLATFORM SAFETY (STRICT):
- NEVER auto-submit job applications.
- NEVER simulate submit clicks.
- NEVER bypass CAPTCHA.
- NEVER scrape, crawl, or store jobs from restricted platforms (LinkedIn, Naukri, Indeed).
- NEVER show restricted jobs as cards on the website.
- ONLY read the currently opened job page AFTER explicit user click.
- Restricted job data must be SESSION-ONLY.
- Autofill ONLY visible, user-editable fields.
- NEVER fill hidden, tracking, or anti-bot fields.
- NEVER simulate human behavior (no fake typing, mouse movement, delays).
- ALL actions must be user-initiated and visible.

If a feature violates these rules, DO NOT implement it.

========================
PRODUCT ARCHITECTURE
========================

WEBSITE (MAIN PRODUCT):
- Job board with job cards from open sources only
- Job relevance score (% match)
- Resume builder and editor
- Resume remodeling per job (optimize wording ONLY)
- Application question bank (editable anytime)
- Application tracking
- Chrome extension download CTA

CHROME EXTENSION (ASSISTANT ONLY):
- Works on any job page
- Reads job description after user click
- Shows relevance score
- Uses stored user data for autofill
- Pauses on CAPTCHA
- Requires manual final submit
- Does NOT store jobs
- Does NOT apply automatically

WEBSITE = Job board + AI brain  
EXTENSION = Application assistant

========================
RESUME REMODELING RULES
========================
- Resume can be rewritten ONLY using information already present.
- Do NOT add new skills, companies, roles, experience, or years.
- Allowed changes:
  - Reword bullet points
  - Reorder sections
  - Highlight relevant skills
  - Improve ATS keyword alignment
- Always show preview and require user approval.

========================
APPLICATION ANSWERS
========================
Store reusable user answers for:
- “Why this role?”
- “Why this company?”
- Salary expectations
- Notice period
- Relocation / remote preference
- Custom questions

Users must be able to edit answers anytime.
Extension can autofill these answers but must allow review.

========================
TECH STACK (FIXED)
========================

CHROME EXTENSION:
- Manifest v3
- JavaScript (ES6+)
- Content Scripts
- Service Worker
- Popup UI (HTML + CSS)
- Permissions: activeTab, scripting, storage ONLY

BACKEND:
- Node.js (LTS)
- Express.js
- MongoDB
- JWT Authentication
- Resume storage and processing

AI:
- Resume ↔ Job Description semantic matching
- Skill gap detection
- Resume remodeling
- Cover letter generation
- NO hallucinated experience

FRONTEND (WEBSITE):
- Clean, modern, JobRight-style UI
- Card-based job listings
- Match score visualization
- Sticky side panels
- Minimal, professional design

========================
UI / UX REQUIREMENTS
========================
- Job cards with relevance score
- Filters (role, location, skills)
- Sticky job relevance panel
- Progress steps:
  Analyze → Match → Prepare → Apply
- Calm, professional colors
- No clutter, no heavy animations

========================
CODE QUALITY
========================
- Modular
- Readable
- Commented
- Production-ready
- No placeholder logic
- Chrome Web Store–safe

========================
OUTPUT RULES FOR COPILOT
========================
- Follow ALL rules above strictly.
- NEVER generate auto-submit logic.
- NEVER generate scraping logic for restricted sites.
- NEVER generate background automation.
- If unsure, choose the safer option.
- Add comments explaining safety decisions when relevant.

========================
FINAL PRODUCT DEFINITION
========================
An AI-powered job discovery and application assistant that shows relevant jobs from open sources, helps users optimize resumes, stores application answers, and autofills applications across the web—while keeping users fully in control of the final submission.
