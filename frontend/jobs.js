// Jobs page logic
let currentJobs = [];
let currentPage = 0;
const JOBS_PER_PAGE = 12;

// Load jobs from API
async function loadJobs(query = '', location = '', sort = 'recent') {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const emptyState = document.getElementById('emptyState');
    const jobsGrid = document.getElementById('jobsGrid');

    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    jobsGrid.innerHTML = '';

    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (location) params.append('location', location);

        const response = await apiRequest(`/api/jobs?${params.toString()}`);
        
        if (!response.ok) throw new Error('Failed to fetch jobs');

        const data = await response.json();
        currentJobs = data.jobs || [];

        loadingState.style.display = 'none';

        if (currentJobs.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        // Sort jobs
        if (sort === 'relevance' && isLoggedIn()) {
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
    const card = document.createElement('div');
    card.className = 'job-card';
    
    const hasRelevance = isLoggedIn() && job.relevanceScore !== undefined;
    
    card.innerHTML = `
        <div class="job-card-header">
            <div class="job-title">${escapeHtml(job.title)}</div>
            <div class="job-company">${escapeHtml(job.company)}</div>
        </div>
        
        <div class="job-meta">
            <span>📍 ${escapeHtml(job.location || 'Remote')}</span>
            <span>🕒 ${getTimeAgo(job.createdAt)}</span>
        </div>
        
        <div class="job-description">
            ${escapeHtml(truncate(job.description || job.summary || '', 150))}
        </div>
        
        ${hasRelevance ? `
            <div class="job-relevance show">
                <div class="relevance-score">${job.relevanceScore}% Match</div>
                <div class="relevance-text">Based on your resume</div>
            </div>
        ` : ''}
        
        <div class="job-actions">
            <button class="btn-secondary" onclick="viewJobDetails('${job._id}')">View Details</button>
            <button class="btn-primary" onclick="applyToJob('${job._id}')">Apply Now</button>
        </div>
    `;
    
    return card;
}

// View job details
function viewJobDetails(jobId) {
    window.location.href = `job-details.html?id=${jobId}`;
}

// Apply to job
function applyToJob(jobId) {
    const job = currentJobs.find(j => j._id === jobId);
    if (!job) return;
    
    if (!isLoggedIn()) {
        showToast('Please login to apply', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return;
    }
    
    // Open job source URL
    if (job.url) {
        window.open(job.url, '_blank');
    } else {
        showToast('Job application link not available', 'error');
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function getTimeAgo(date) {
    if (!date) return 'Recently';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Load jobs on page load
    loadJobs();
    
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    searchBtn?.addEventListener('click', () => {
        const query = document.getElementById('searchQuery').value;
        const location = document.getElementById('locationFilter').value;
        currentPage = 0;
        document.getElementById('jobsGrid').innerHTML = '';
        loadJobs(query, location);
    });
    
    // Sort change
    const sortBy = document.getElementById('sortBy');
    sortBy?.addEventListener('change', (e) => {
        currentPage = 0;
        document.getElementById('jobsGrid').innerHTML = '';
        const query = document.getElementById('searchQuery').value;
        const location = document.getElementById('locationFilter').value;
        loadJobs(query, location, e.target.value);
    });
    
    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    loadMoreBtn?.addEventListener('click', () => {
        currentPage++;
        renderJobs();
    });
    
    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    retryBtn?.addEventListener('click', () => {
        const query = document.getElementById('searchQuery').value;
        const location = document.getElementById('locationFilter').value;
        loadJobs(query, location);
    });
    
    // Search on Enter key
    document.getElementById('searchQuery')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });
    
    document.getElementById('locationFilter')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });
});
