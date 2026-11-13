/**
 * Admin Authentication Controller
 * Uses Firebase Authentication (Email/Password & Google Sign-In)
 */

import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged, 
  isFirebaseConfigured 
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const errorAlert = document.getElementById('login-error-alert');
  const submitBtn = document.getElementById('login-submit-btn');
  const googleBtn = document.getElementById('google-login-btn');
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
  const authTitle = document.getElementById('auth-title');
  const authDesc = document.getElementById('auth-desc');
  const demoNotice = document.getElementById('demo-credentials-notice');

  let isRegisterMode = false;

  // Toggle between Sign In and Create Account
  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      if (isRegisterMode) {
        if (authTitle) authTitle.innerText = "Register Administrator";
        if (authDesc) authDesc.innerText = "Create a new administrator account in your Firebase project";
        if (submitBtn) submitBtn.innerText = "Create Admin Account";
        toggleAuthModeBtn.innerText = "Already have an account? Sign in here";
      } else {
        if (authTitle) authTitle.innerText = "Administrator Portal";
        if (authDesc) authDesc.innerText = "Sign in with your authorized Firebase administrator credentials";
        if (submitBtn) submitBtn.innerText = "Sign In to Dashboard";
        toggleAuthModeBtn.innerText = "Need to create your first Admin Account? Click here";
      }
      hideError();
    });
  }

  // Show demo helper if Firebase credentials are placeholder
  if (!isFirebaseConfigured() && demoNotice) {
    demoNotice.style.display = 'block';
  }

  // Check if admin is already logged in
  if (auth && isFirebaseConfigured()) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        sessionStorage.setItem('spin_admin_email', user.email || 'Admin');
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

  // Google Sign-In
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      hideError();
      googleBtn.disabled = true;

      try {
        if (auth && isFirebaseConfigured()) {
          const provider = new GoogleAuthProvider();
          provider.addScope('profile');
          provider.addScope('email');
          provider.setCustomParameters({ prompt: 'select_account' });

          const result = await signInWithPopup(auth, provider);
          console.log("Google Sign-In successful:", result.user.email);
          sessionStorage.setItem('spin_admin_session', 'active');
          sessionStorage.setItem('spin_admin_email', result.user.email);
          window.location.href = 'dashboard.html';
        } else {
          // Demo fallback
          sessionStorage.setItem('spin_admin_session', 'mock_google_token');
          sessionStorage.setItem('spin_admin_email', 'google_admin@spinwin.local');
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        console.error("Google Sign-In Error:", err);
        let msg = "Google sign-in could not be completed.";
        if (err.code === 'auth/popup-closed-by-user') {
          msg = "Google sign-in popup was closed before completing.";
        } else if (err.code === 'auth/unauthorized-domain') {
          msg = "This domain is not authorized in Firebase Console -> Authentication -> Settings -> Authorized Domains. Please add this domain.";
        } else if (err.code === 'auth/operation-not-allowed') {
          msg = "Google Sign-In is not enabled in Firebase Console -> Authentication -> Sign-in method. Please toggle Google on.";
        } else {
          msg = err.message || msg;
        }
        showError(msg);
      } finally {
        googleBtn.disabled = false;
      }
    });
  }

  // Form submission (Email/Password Sign-In or Registration)
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput?.value.trim();
      const password = passwordInput?.value.trim();

      if (!email || !password) {
        showError("Please enter both email and password.");
        return;
      }

      if (isRegisterMode && password.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
      }

      hideError();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = isRegisterMode ? "Creating Account..." : "Authenticating...";
      }

      try {
        if (auth && isFirebaseConfigured()) {
          if (isRegisterMode) {
            // Create New Admin User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log("Admin account created successfully:", userCredential.user.email);
            sessionStorage.setItem('spin_admin_session', 'active');
            sessionStorage.setItem('spin_admin_email', userCredential.user.email);
            window.location.href = 'dashboard.html';
          } else {
            // Sign In Existing Admin
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Admin logged in successfully:", userCredential.user.email);
            sessionStorage.setItem('spin_admin_session', 'active');
            sessionStorage.setItem('spin_admin_email', userCredential.user.email);
            window.location.href = 'dashboard.html';
          }
        } else {
          // Local Developer / Demo Simulation Fallback
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
          msg = "Invalid administrator credentials. If you haven't created an admin account yet, click 'Need to create your first Admin Account?' below.";
        } else if (err.code === 'auth/email-already-in-use') {
          msg = "This email is already registered. Please sign in instead.";
        } else if (err.code === 'auth/weak-password') {
          msg = "Password is too weak. Please use at least 6 characters.";
        } else if (err.code === 'auth/too-many-requests') {
          msg = "Access temporarily blocked due to repeated failed login attempts. Try again later.";
        } else if (err.code === 'auth/user-disabled') {
          msg = "This administrator account has been disabled.";
        } else if (err.code === 'auth/operation-not-allowed') {
          msg = "Email/Password sign-in is not enabled in Firebase Console. Please enable Email/Password under Authentication -> Sign-in method.";
        } else {
          msg = err.message || "Failed to authenticate. Please verify your credentials.";
        }
        showError(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = isRegisterMode ? "Create Admin Account" : "Sign In to Dashboard";
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
