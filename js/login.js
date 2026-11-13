/**
 * Admin Authentication Controller
 * Supports both Google Sign-In & Firebase Email/Password Authentication
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
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const googleBtn = document.getElementById('google-login-btn');
  const googleBtnText = document.getElementById('google-btn-text');
  const toggleModeBtn = document.getElementById('toggle-auth-mode-btn');
  const authTitle = document.getElementById('auth-title');
  const authDesc = document.getElementById('auth-desc');

  let isRegisterMode = false;

  // Check if admin is already logged in
  if (auth && isFirebaseConfigured()) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        sessionStorage.setItem('spin_admin_session', 'active');
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

  // Toggle Register vs Sign-in Mode
  if (toggleModeBtn) {
    toggleModeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideError();
      isRegisterMode = !isRegisterMode;

      if (isRegisterMode) {
        if (authTitle) authTitle.innerText = "Register Admin Account";
        if (authDesc) authDesc.innerText = "Create your authorized administrator credentials";
        if (submitBtn) submitBtn.innerText = "Create Admin Account";
        toggleModeBtn.innerText = "Already have an admin account? Sign In";
      } else {
        if (authTitle) authTitle.innerText = "Administrator Portal";
        if (authDesc) authDesc.innerText = "Sign in with your Firebase administrator credentials";
        if (submitBtn) submitBtn.innerText = "Sign In to Dashboard";
        toggleModeBtn.innerText = "Need to register your Admin ID? Click here";
      }
    });
  }

  // 1. GOOGLE SIGN-IN HANDLER
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      hideError();

      if (!auth || !isFirebaseConfigured()) {
        showError("Firebase is not fully initialized. Check your credentials.");
        return;
      }

      try {
        googleBtn.disabled = true;
        if (googleBtnText) googleBtnText.innerText = "Connecting to Google...";

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const userCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;
        console.log("Admin logged in via Google successfully:", user.email);

        sessionStorage.setItem('spin_admin_session', 'active');
        sessionStorage.setItem('spin_admin_email', user.email);
        window.location.href = 'dashboard.html';

      } catch (err) {
        console.error("Google Sign-In Error:", err);
        if (err.code === 'auth/unauthorized-domain') {
          showError("Authorized Domain Notice: Please add 'spin-win-project.vercel.app' to Firebase Console -> Authentication -> Settings -> Authorized Domains.");
        } else if (err.code === 'auth/popup-closed-by-user') {
          // Closed by user, no error needed
        } else if (err.code === 'auth/popup-blocked') {
          showError("The sign-in popup was blocked by your browser. Please allow popups for this site.");
        } else if (err.code === 'auth/operation-not-allowed') {
          showError("Google Sign-In is not enabled in Firebase Console. Please enable Google under Authentication -> Sign-in method.");
        } else {
          showError(err.message || "Failed to sign in with Google.");
        }
      } finally {
        googleBtn.disabled = false;
        if (googleBtnText) googleBtnText.innerText = "Continue with Google";
      }
    });
  }

  // 2. EMAIL & PASSWORD SUBMISSION (SIGN-IN & REGISTRATION)
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      let inputVal = (emailInput?.value || '').trim();
      const password = (passwordInput?.value || '').trim();

      if (!inputVal || !password) {
        showError("Please enter both administrator email/username and password.");
        return;
      }

      // If user provided a username without '@', format to valid email domain
      let email = inputVal;
      if (!email.includes('@')) {
        email = `${email.toLowerCase()}@spinwin.com`;
      }

      hideError();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = isRegisterMode ? "Creating Account..." : "Authenticating...";
      }

      try {
        if (auth && isFirebaseConfigured()) {
          if (isRegisterMode) {
            // Create New Admin Account
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
            sessionStorage.setItem('spin_admin_session', 'active');
            sessionStorage.setItem('spin_admin_email', email);
            window.location.href = 'dashboard.html';
          } else {
            showError("Authentication Error: Firebase keys are unconfigured. To test the dashboard in demo mode, use email containing 'admin' (e.g., admin@spinwin.com).");
          }
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        let msg = "Invalid email or password.";

        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          msg = "Administrator account not found or invalid credentials. If this is your first time, click 'Need to register your Admin ID' below to create your login.";
        } else if (err.code === 'auth/wrong-password') {
          msg = "Incorrect password. Please verify your password.";
        } else if (err.code === 'auth/email-already-in-use') {
          msg = "This email is already registered. Please switch to Sign In mode.";
        } else if (err.code === 'auth/weak-password') {
          msg = "Password should be at least 6 characters long.";
        } else if (err.code === 'auth/invalid-email') {
          msg = "Invalid email format. Please provide a valid email address.";
        } else if (err.code === 'auth/too-many-requests') {
          msg = "Access temporarily blocked due to repeated failed login attempts. Try again later.";
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
