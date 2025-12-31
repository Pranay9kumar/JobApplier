// Jobs page logic
let currentJobs = [];
let currentPage = 0;
const JOBS_PER_PAGE = 12;

// Safe escapeHtml function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Load jobs from API
async function loadJobs(query = '', location = '', sort = 'recent') {
    console.log('Loading jobs:', { query, location, sort });
    
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const emptyState = document.getElementById('emptyState');
    const jobsGrid = document.getElementById('jobsGrid');

    if (!loadingState || !errorState || !emptyState || !jobsGrid) {
        console.error('Required DOM elements not found');
        return;
    }

    // Validate search query
    if (query && typeof Validators !== 'undefined') {
        const queryValidation = Validators.searchQuery(query);
        if (!queryValidation.valid) {
            if (typeof showToast !== 'undefined') {
                showToast(queryValidation.message, 'error');
            }
            return;
        }
    }

    // Validate location
    if (location && location.length > 100) {
        if (typeof showToast !== 'undefined') {
            showToast('Location string too long', 'error');
        }
        return;
    }

    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    jobsGrid.innerHTML = '';

    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query.trim());
        if (location) params.append('location', location.trim());

        const url = `${API_BASE}/api/jobs${params.toString() ? '?' + params.toString() : ''}`;
        console.log('Fetching jobs from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(typeof getAuthToken === 'function' && getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
            }
        });
        
        console.log('Jobs response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Jobs data:', data);
        
        currentJobs = data.jobs || [];

        loadingState.style.display = 'none';

        if (currentJobs.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        // Sort jobs
        if (sort === 'relevance' && typeof isLoggedIn === 'function' && isLoggedIn()) {
            currentJobs.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        }

        renderJobs();
    } catch (error) {
        console.error('Error loading jobs:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
    }
}

// Render job cards
function renderJobs() {
    const jobsGrid = document.getElementById('jobsGrid');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    
    const startIdx = currentPage * JOBS_PER_PAGE;
    const endIdx = startIdx + JOBS_PER_PAGE;
    const jobsToShow = currentJobs.slice(startIdx, endIdx);

    jobsToShow.forEach(job => {
        const card = createJobCard(job);
        jobsGrid.appendChild(card);
    });

    // Show/hide load more button
    if (endIdx < currentJobs.length) {
        loadMoreContainer.style.display = 'block';
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

// Create job card element
function createJobCard(job) {
    if (!job) return document.createElement('div');
    
    const card = document.createElement('div');
    card.className = 'job-card';
    card.style.animationDelay = `${Math.random() * 0.2}s`;
    
    const userLoggedIn = typeof isLoggedIn === 'function' && isLoggedIn();
    const hasRelevance = userLoggedIn && job.relevanceScore !== undefined && job.relevanceScore !== null;
    
    const title = escapeHtml(job.title || 'Untitled Position');
    const company = escapeHtml(job.company || 'Company');
    const location = escapeHtml(job.location || 'Remote');
    const description = escapeHtml(truncate(job.description || job.summary || 'No description available', 150));
    const timeAgo = getTimeAgo(job.createdAt);
    const jobId = String(job._id || '');
    
    let cardHTML = `
        <div class="job-card-header">
            <div class="job-title">${title}</div>
            <div class="job-company">${company}</div>
        </div>
        
        <div class="job-meta">
            <span>📍 ${location}</span>
            <span>🕒 ${timeAgo}</span>
        </div>
        
        <div class="job-description">
            ${description}
        </div>
    `;
    
    if (hasRelevance) {
        const score = Math.round(job.relevanceScore);
        cardHTML += `
            <div class="job-relevance show" style="animation: fadeIn 0.5s ease;">
                <div class="relevance-score">${score}% Match</div>
                <div class="relevance-text">Based on your resume</div>
            </div>
        `;
    }
    
    cardHTML += `
        <div class="job-actions">
            <button class="btn-secondary job-details-btn" data-job-id="${jobId}" style="transition: all 0.3s;">
                👁️ View Details
            </button>
            <button class="btn-primary job-apply-btn" data-job-id="${jobId}" style="transition: all 0.3s;">
                🚀 Apply Now
            </button>
        </div>
    `;
    
    card.innerHTML = cardHTML;
    
    // Add event listeners
    const detailsBtn = card.querySelector('.job-details-btn');
    const applyBtn = card.querySelector('.job-apply-btn');
    
    if (detailsBtn) {
        detailsBtn.addEventListener('click', () => viewJobDetails(jobId));
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => applyToJob(jobId));
    }
    
    return card;
}
        <div class="job-meta">
            <span>📍 ${escapeHtml(job.location || 'Remote')}</span>
            <span>🕒 ${getTimeAgo(job.createdAt)}</span>
        </div>
        
        <div class="job-description">
            ${escapeHtml(truncate(job.description || job.summary || '', 150))}
        </div>
        
        ${hasRelevance ? `
            <div class="job-relevance show" style="animation: fadeIn 0.5s ease;">
                <div class="relevance-score">${job.relevanceScore}% Match</div>
                <div class="relevance-text">Based on your resume</div>
            </div>
        ` : ''}
        
        <div class="job-actions">
            <button class="btn-secondary" onclick="viewJobDetails('${job._id}')" style="transition: all 0.3s;">
                👁️ View Details
            </button>
            <button class="btn-primary" onclick="applyToJob('${job._id}')" style="transition: all 0.3s;">
                🚀 Apply Now
            </button>
        </div>
    `;
    
    return card;
}


// View job details
function viewJobDetails(jobId) {
    console.log('Viewing job:', jobId);
    // For now, just show details - can implement modal later
    const job = currentJobs.find(j => String(j._id) === String(jobId));
    if (job) {
        console.log('Job details:', job);
        // Could open modal or navigate to details page
    }
}

// Apply to job
function applyToJob(jobId) {
    console.log('Applying to job:', jobId);
    const job = currentJobs.find(j => String(j._id) === String(jobId));
    if (!job) {
        console.error('Job not found:', jobId);
        return;
    }
    
    const userLoggedIn = typeof isLoggedIn === 'function' && isLoggedIn();
    
    if (!userLoggedIn) {
        if (typeof showToast === 'function') {
            showToast('Please login to apply', 'error');
        }
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return;
    }
    
    // Open job source URL
    if (job.url) {
        window.open(job.url, '_blank');
    } else {
        if (typeof showToast === 'function') {
            showToast('Job application link not available', 'error');
        }
        console.warn('No URL for job:', job);
    }
}

// Utility functions
function truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function getTimeAgo(date) {
    if (!date) return 'Recently';
    try {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(date).toLocaleDateString();
    } catch (e) {
        return 'Recently';
    }
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
    console.log('Jobs page loaded');
    
    // Check required functions
    if (typeof API_BASE === 'undefined') {
        console.error('API_BASE not defined. config.js may not be loaded.');
    }
    
    // Load jobs on page load
    try {
        loadJobs();
    } catch (error) {
        console.error('Error during initial load:', error);
    }
    
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const queryInput = document.getElementById('searchQuery');
            const locationInput = document.getElementById('locationFilter');
            const query = queryInput ? queryInput.value : '';
            const location = locationInput ? locationInput.value : '';
            currentPage = 0;
            const jobsGrid = document.getElementById('jobsGrid');
            if (jobsGrid) jobsGrid.innerHTML = '';
            loadJobs(query, location);
        });
    }
    
    // Sort change
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            currentPage = 0;
            const jobsGrid = document.getElementById('jobsGrid');
            if (jobsGrid) jobsGrid.innerHTML = '';
            const queryInput = document.getElementById('searchQuery');
            const locationInput = document.getElementById('locationFilter');
            const query = queryInput ? queryInput.value : '';
            const location = locationInput ? locationInput.value : '';
            loadJobs(query, location, e.target.value);
        });
    }
    
    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            renderJobs();
        });
    }
    
    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            const queryInput = document.getElementById('searchQuery');
            const locationInput = document.getElementById('locationFilter');
            const query = queryInput ? queryInput.value : '';
            const location = locationInput ? locationInput.value : '';
            loadJobs(query, location);
        });
    }
    
    // Search on Enter key
    const searchQuery = document.getElementById('searchQuery');
    if (searchQuery) {
        searchQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchBtn) searchBtn.click();
        });
    }
    
    const locationFilter = document.getElementById('locationFilter');
    if (locationFilter) {
        locationFilter.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchBtn) searchBtn.click();
        });
    }
});
