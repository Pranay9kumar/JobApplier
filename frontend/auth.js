// Auth state management
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const user = getUser();

    if (isLoggedIn() && user) {
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) {
            userMenu.style.display = 'flex';
            userMenu.style.gap = '16px';
            userMenu.style.alignItems = 'center';
            document.getElementById('userName').textContent = user.name || user.email;
        }
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (authButtons) authButtons.style.gap = '12px';
        if (userMenu) userMenu.style.display = 'none';
    }
}

// Logout handler
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearAuth();
            showToast('Logged out successfully');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        });
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    setupLogout();
});

// Fetch current user data
async function fetchUserData() {
    if (!isLoggedIn()) return null;

    try {
        const response = await apiRequest('/api/me');
        if (response.ok) {
            const data = await response.json();
            saveAuth(getAuthToken(), getRefreshToken(), data.user);
            updateAuthUI();
            return data.user;
        }
    } catch (error) {
        console.error('Failed to fetch user data:', error);
    }
    return null;
}

// Require authentication (redirect to login if not logged in)
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return false;
    }
    return true;
}
