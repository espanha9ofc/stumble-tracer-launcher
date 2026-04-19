document.addEventListener('DOMContentLoaded', async () => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    // Handle OAuth callback success
    if (token) {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminName', 'Master Admin');
        window.history.replaceState({}, document.title, '/');
        window.location.href = '/dashboard.html';
        return;
    }

    // Handle OAuth errors
    const errEl = document.getElementById('error-msg');
    if (error && errEl) {
        errEl.classList.add('visible');
        if (error === 'unauthorized') {
            errEl.textContent = 'Access Denied: You are not the master admin.';
        } else if (error === 'session_expired') {
            errEl.textContent = 'Session expired. Please login again.';
        } else if (error === 'no_code' || error === 'oauth_failed') {
            errEl.textContent = 'Discord login failed. Please try again.';
        } else {
            errEl.textContent = 'An authentication error occurred.';
        }
        window.history.replaceState({}, document.title, '/');
    }

    // C6 fix: Validate token before auto-redirect
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
        try {
            const res = await fetch('/api/analytics', {
                headers: { 'x-auth-token': savedToken }
            });
            if (res.status === 401) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminName');
                // Token expired, don't redirect
            } else {
                window.location.href = '/dashboard.html';
            }
        } catch (e) {
            // Network error, try redirect anyway
            window.location.href = '/dashboard.html';
        }
    }
});
