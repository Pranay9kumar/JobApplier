// API Configuration
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000'
    : 'https://applier-backend.onrender.com'; // Update after deployment

// Auth token storage
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

// Get stored auth data
function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function getUser() {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
}

// Save auth data
function saveAuth(accessToken, refreshToken, user) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Clear auth data
function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

// Check if user is logged in
function isLoggedIn() {
    return !!getAuthToken();
}

// API request helper with auth
async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    // Handle token expiration
    if (response.status === 401) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            // Try to refresh token
            try {
                const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshResponse.ok) {
                    const { accessToken, refreshToken: newRefreshToken } = await refreshResponse.json();
                    saveAuth(accessToken, newRefreshToken);
                    
                    // Retry original request
                    headers['Authorization'] = `Bearer ${accessToken}`;
                    return fetch(`${API_BASE}${endpoint}`, { ...options, headers });
                }
            } catch (e) {
                clearAuth();
                window.location.href = 'login.html';
            }
        } else {
            clearAuth();
            window.location.href = 'login.html';
        }
    }

    return response;
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✓' : '✕'}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
