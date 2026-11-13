/**
 * Admin Authentication Controller
 * Uses Firebase Authentication (Email / Password)
 */

import { 
  auth, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  isFirebaseConfigured 
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const errorAlert = document.getElementById('login-error-alert');
  const submitBtn = document.getElementById('login-submit-btn');
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const demoNotice = document.getElementById('demo-credentials-notice');

  // Show demo helper if Firebase credentials are placeholder
  if (!isFirebaseConfigured() && demoNotice) {
    demoNotice.style.display = 'block';
  }

  // Check if admin is already logged in
  if (auth && isFirebaseConfigured()) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        window.location.href = 'dashboard.html';
      }
    });
  } else {
    // Check local session
    if (sessionStorage.getItem('spin_admin_session')) {
      window.location.href = 'dashboard.html';
    }
  }

  // Toggle password visibility
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPass ? 'text' : 'password');
      togglePassBtn.innerText = isPass ? '👁️' : '👁️‍🗨️';
    });
  }

  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput?.value.trim();
      const password = passwordInput?.value.trim();

      if (!email || !password) {
        showError("Please enter both email and password.");
        return;
      }

      hideError();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Authenticating...";
      }

      try {
        if (auth && isFirebaseConfigured()) {
          // Live Firebase Authentication
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          console.log("Admin logged in successfully:", userCredential.user.email);
          sessionStorage.setItem('spin_admin_email', userCredential.user.email);
          window.location.href = 'dashboard.html';
        } else {
          // Local Developer / Demo Simulation Fallback
          // Allows testing dashboard layout before Firebase project is wired
          if (email.toLowerCase().includes('admin') || email.toLowerCase().includes('demo')) {
            sessionStorage.setItem('spin_admin_session', 'mock_admin_token');
            sessionStorage.setItem('spin_admin_email', email);
            window.location.href = 'dashboard.html';
          } else {
            showError("Authentication Error: Firebase keys are unconfigured. To test the dashboard in demo mode, use email containing 'admin' (e.g., admin@example.com).");
          }
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        let msg = "Invalid email or password.";
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = "Invalid administrator credentials. Please check your email and password.";
        } else if (err.code === 'auth/too-many-requests') {
          msg = "Access temporarily blocked due to repeated failed login attempts. Try again later.";
        } else if (err.code === 'auth/user-disabled') {
          msg = "This administrator account has been disabled.";
        } else {
          msg = err.message || "Failed to sign in. Please verify your credentials.";
        }
        showError(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Sign In to Admin Dashboard";
        }
      }
    });
  }

  function showError(msg) {
    if (!errorAlert) return;
    errorAlert.innerText = msg;
    errorAlert.style.display = 'block';
  }

  function hideError() {
    if (!errorAlert) return;
    errorAlert.style.display = 'none';
  }
});
