// Validation utilities
const Validators = {
    // Email validation (RFC 5322 simplified)
    email: (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email) && email.length <= 254;
    },

    // Password strength validation
    password: (password) => {
        if (password.length < 8) return { valid: false, message: 'At least 8 characters' };
        if (password.length > 128) return { valid: false, message: 'Maximum 128 characters' };
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

        const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
        
        if (strength < 3) {
            return { 
                valid: false, 
                message: 'Use uppercase, lowercase, numbers, and special characters' 
            };
        }
        
        return { valid: true, message: 'Strong password' };
    },

    // Name validation
    name: (name) => {
        const trimmed = name.trim();
        if (trimmed.length < 2) return { valid: false, message: 'At least 2 characters' };
        if (trimmed.length > 100) return { valid: false, message: 'Maximum 100 characters' };
        
        // Allow letters, spaces, hyphens, apostrophes
        if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
            return { valid: false, message: 'Only letters, spaces, hyphens, and apostrophes allowed' };
        }
        
        return { valid: true };
    },

    // Resume text validation
    resumeText: (text) => {
        const trimmed = text.trim();
        if (trimmed.length < 50) return { valid: false, message: 'Resume too short (minimum 50 characters)' };
        if (trimmed.length > 50000) return { valid: false, message: 'Resume too long (maximum 50,000 characters)' };
        
        return { valid: true };
    },

    // File validation
    file: (file, maxSizeMB = 5) => {
        const maxBytes = maxSizeMB * 1024 * 1024;
        
        if (!file) return { valid: false, message: 'No file selected' };
        if (file.size > maxBytes) return { valid: false, message: `File too large (max ${maxSizeMB}MB)` };
        if (file.type !== 'application/pdf') return { valid: false, message: 'Only PDF files allowed' };
        
        return { valid: true };
    },

    // Search query validation
    searchQuery: (query) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return { valid: true }; // Empty is ok
        if (trimmed.length > 100) return { valid: false, message: 'Search query too long' };
        
        // Block SQL/NoSQL injection patterns
        const dangerousPatterns = [
            /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|;|--|\*|\/\*)/i,
            /[$\{\}]/,
            /\\x[0-9a-f]{2}/i
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(trimmed)) {
                return { valid: false, message: 'Invalid characters in search' };
            }
        }
        
        return { valid: true };
    }
};

// Sanitization utilities
const Sanitizers = {
    // Escape HTML to prevent XSS
    html: (text) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    // Trim and normalize input
    text: (text) => {
        return text.trim().replace(/\s+/g, ' ');
    },

    // Email to lowercase
    email: (email) => {
        return email.trim().toLowerCase();
    }
};

// Display validation error
function showValidationError(field, message) {
    const errorEl = document.getElementById(`${field}-error`);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.style.color = '#c62828';
        errorEl.style.fontSize = '12px';
        errorEl.style.marginTop = '4px';
    }
    
    const input = document.getElementById(field);
    if (input) {
        input.style.borderColor = '#c62828';
    }
}

// Clear validation error
function clearValidationError(field) {
    const errorEl = document.getElementById(`${field}-error`);
    if (errorEl) {
        errorEl.style.display = 'none';
    }
    
    const input = document.getElementById(field);
    if (input) {
        input.style.borderColor = '';
    }
}

// Show success message
function showValidationSuccess(field) {
    const input = document.getElementById(field);
    if (input) {
        input.style.borderColor = '#2e7d32';
    }
}

// Real-time validation
function setupRealtimeValidation() {
    // Email validation
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            const email = Sanitizers.email(emailInput.value);
            if (email && !Validators.email(email)) {
                showValidationError('email', 'Invalid email address');
            } else {
                clearValidationError('email');
            }
        });
        
        emailInput.addEventListener('input', () => {
            clearValidationError('email');
        });
    }

    // Password validation
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            if (password) {
                const validation = Validators.password(password);
                if (validation.valid) {
                    showValidationSuccess('password');
                } else {
                    showValidationError('password', validation.message);
                }
            } else {
                clearValidationError('password');
            }
        });
    }

    // Name validation
    const nameInput = document.getElementById('name');
    if (nameInput) {
        nameInput.addEventListener('blur', () => {
            const name = nameInput.value;
            if (name) {
                const validation = Validators.name(name);
                if (validation.valid) {
                    showValidationSuccess('name');
                } else {
                    showValidationError('name', validation.message);
                }
            } else {
                clearValidationError('name');
            }
        });
        
        nameInput.addEventListener('input', () => {
            clearValidationError('name');
        });
    }

    // Resume text validation
    const resumeInput = document.getElementById('resumeText');
    if (resumeInput) {
        resumeInput.addEventListener('blur', () => {
            const text = resumeInput.value;
            if (text) {
                const validation = Validators.resumeText(text);
                if (!validation.valid) {
                    showValidationError('resumeText', validation.message);
                } else {
                    showValidationSuccess('resumeText');
                }
            } else {
                clearValidationError('resumeText');
            }
        });
        
        resumeInput.addEventListener('input', () => {
            clearValidationError('resumeText');
        });
    }

    // Search validation
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value;
            const validation = Validators.searchQuery(query);
            if (!validation.valid) {
                showValidationError('searchQuery', validation.message);
            } else {
                clearValidationError('searchQuery');
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', setupRealtimeValidation);
