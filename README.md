# ⚡ Premium Spin & Win Platform with Firestore Admin Dashboard

A high-performance promotional gaming web application built with **pure HTML5, CSS3, and modern vanilla JavaScript (ES Modules)**, backed by **Google Firebase Cloud Firestore**, **Firebase Authentication**, and **Firebase Storage**.

Designed with a cosmic dark navy & violet aesthetic, glowing neon bezels, liquid gold accents, glassmorphic surfaces, and responsive layouts.

---

## 📁 1. Project Folder Structure

```
spin-win-project/
├── index.html              # Public Spin & Win promotional wheel page
├── login.html              # Secure administrator authentication page
├── dashboard.html          # Executive admin analytics & management control center
├── privacy.html            # Detailed privacy policy & consent disclosures
├── terms.html              # Promotional terms, eligibility & legal rules
├── css/
│   ├── style.css           # Global design system, glassmorphism, modals & typography
│   ├── wheel.css           # Custom canvas wheel, neon bezel, golden pointer & animations
│   └── dashboard.css       # Admin dashboard cards, data tables, grids & badges
├── js/
│   ├── firebase-config.js  # Firebase SDK v10 Modular client, Firestore & fallback store
│   ├── spin.js             # High-DPI canvas wheel engine, physics deceleration & Web Audio
│   ├── rewards.js          # UPI validation, claim submission & verification modals
│   ├── permissions.js      # Granular consent handling, camera hardware & geolocation
│   ├── login.js            # Firebase Auth administrator login controller
│   ├── dashboard.js        # Analytics calculation, live tables, claim actions & CSV export
│   └── uploads.js          # Image compression, camera snapshot & gallery upload pipeline
├── assets/
│   ├── images/             # Vector branding graphics & SVGs
│   ├── sounds/             # Web Audio architecture notes & sound references
│   └── icons/              # Vector icons (trophy, shield, camera, map-pin)
├── firestore.rules         # Enterprise Firestore security rules
├── storage.rules           # Firebase Storage security rules
├── .gitignore              # Git ignore rules for keys, caches & environment files
├── .env.example            # Environment configuration template
├── README.md               # Complete setup, testing, GitHub & Vercel documentation
└── vercel.json             # Vercel deployment configuration & security headers
```

---

## 🚀 2. Key Features

- **100% Vanilla Stack:** No React, Vue, Angular, webpack, or complex build toolchain. Runs directly in any modern web browser.
- **High-DPI Canvas Wheel:** Custom 10-slice wheel with special prominent styling for **₹1,000** and **₹10,000** jackpot slices.
- **Realistic Deceleration Physics:** Cubic-bezier easing curve with dynamic Web Audio API ticks that slow down alongside the wheel.
- **Confetti & Victory Fanfare:** Dynamic canvas particle celebration upon winning.
- **Secure UPI Claim Flow:** Strict NPCI UPI pattern validation (`name@bank`). Collects Virtual Payment Address with zero PIN, OTP, or password requests.
- **Independent & Granular Consent:**
  - **Location:** Explicit consent before calling `navigator.geolocation`. Coordinates formatted and saved.
  - **Camera:** Front vs rear camera selector. Live preview with user-triggered snapshot, retake, delete, and immediate stream shutdown.
  - **Gallery:** Browser file picker. Only selected and confirmed images are uploaded; never indexes device gallery.
  - **Withdrawal:** Instant "Withdraw All Consents" button updating audit records.
- **Executive Admin Dashboard:**
  - Real-time statistics: Total spinners, total spins, prize frequency breakdown, ₹1,000 wins, ₹10,000 jackpots, pending claims, submitted UPIs, location consents, camera selfies, and gallery uploads.
  - Interactive tables with live search, date filters, and prize filters.
  - Claim management: 1-click **Approve** / **Reject** buttons updating Firestore directly.
  - Full-resolution image lightbox preview for visitor uploads.
  - Client-side **CSV Data Export** for all tables.
- **Hybrid Local Fallback Mode:** The app includes an active local simulation store. You can test all spins, modals, camera snaps, gallery picks, and dashboard metrics immediately even before wiring live Firebase credentials!

---

## 🔥 3. Firebase Console Setup Guide

Follow these steps to connect your live Firebase backend:

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (e.g. name it `spin-win-project`).
3. Disable or enable Google Analytics according to your preference, then click **Create project**.

### Step 2: Register Web App & Get Config
1. On your Firebase Project Overview page, click the **Web icon** (`</>`) to add an app.
2. Enter an app nickname (e.g. `spin-win-web`).
3. Click **Register app**.
4. Copy the `firebaseConfig` object and replace the placeholder in `js/firebase-config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSyYOUR_REAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

### Step 3: Enable Cloud Firestore
1. In the Firebase left sidebar, click **Build** -> **Firestore Database**.
2. Click **Create database**.
3. Select a geographical location close to your users (e.g., `asia-south1` or `us-central1`).
4. Choose **Start in production mode**.
5. Click **Create**.
6. Go to the **Rules** tab, paste the contents of `firestore.rules`, and click **Publish**.

### Step 4: Enable Firebase Authentication
1. In the Firebase sidebar, click **Build** -> **Authentication**.
2. Click **Get started**.
3. In the **Sign-in method** tab, select **Email/Password**.
4. Toggle **Enable** on and click **Save**.
5. Go to the **Users** tab and click **Add user**.
6. Enter your Administrator email (e.g. `admin@spinwin.com`) and a strong password. This account will have administrative access to `dashboard.html`.

### Step 5: Enable Firebase Storage (Optional for Images)
1. In the Firebase sidebar, click **Build** -> **Storage**.
2. Click **Get started**, choose **Production mode**, and pick the default bucket.
3. Go to the **Rules** tab, paste the contents of `storage.rules`, and click **Publish**.

---

## 🔒 4. Firestore Security Rules Explained

The included `firestore.rules` enforces enterprise zero-trust principles:
- **Public Write Only Where Needed:** Visitors can only create documents in `spin_results`, `reward_claims`, `consent_records`, `visitor_locations`, and `visitor_uploads` with strict field validation.
- **Zero Public Read on Sensitive Data:** Public visitors **cannot** read all spin results or inspect submitted UPI IDs.
- **Admin-Gated Reads & Status Updates:** Only users authenticated via Firebase Auth (`request.auth != null`) can query claims, view locations, inspect uploads, and update claim statuses (`approved`/`rejected`).

---

## 🧪 5. Local Testing Instructions

You can serve the project using any static HTTP web server:

### Option A: Python 3 Built-in Server
```bash
cd /data/spin-win-project
python3 -m http.server 8080
```
Open `http://localhost:8080` in your browser.

### Option B: Node.js `npx serve`
```bash
cd /data/spin-win-project
npx serve -l 8080 .
```

### Option C: VS Code Live Server
Right-click `index.html` and select **Open with Live Server**.

> **Testing Without Live Firebase:** The app automatically detects placeholder keys and runs in **Local Simulation Mode**. All data is safely stored in `localStorage`, allowing you to spin the wheel, test the UPI claim modal, grant/skip permissions, capture camera snapshots, view the admin dashboard, approve claims, and export CSVs immediately!

---

## 🐙 6. GitHub Repository Preparation & Push Commands

Initialize and push the clean codebase to your GitHub repository:

```bash
cd /data/spin-win-project

# 1. Initialize git
git init

# 2. Stage all project files (sensitive files excluded via .gitignore)
git add .

# 3. Create initial commit
git commit -m "feat: complete premium spin and win platform with firestore admin dashboard"

# 4. Set main branch
git branch -M main

# 5. Link your GitHub remote repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/spin-win-project.git

# 6. Push to GitHub
git push -u origin main
```

---

## ☁️ 7. Vercel Deployment Guide

Deploying this static project to Vercel takes less than two minutes:

### Step 1: Import Project into Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository (`spin-win-project`).
4. In the **Project Settings**:
   - **Framework Preset:** Leave as `Other` (Static HTML).
   - **Root Directory:** `./`
   - **Build & Output Settings:** None needed (static files).
5. Click **Deploy**.

### Step 2: Add Vercel Domain to Firebase Authorized Domains (CRITICAL!)
To allow Firebase Authentication to function on your live Vercel deployment:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Authentication** -> **Settings** -> **Authorized domains**.
3. Click **Add domain**.
4. Enter your Vercel deployment domain (e.g. `spin-win-project.vercel.app`).
5. Click **Done**.

---

## 🛡️ 8. Security Limitations & Architectural Considerations

### Browser-Only Client Limitations
Per the architecture requirements, this project operates directly in the browser using the Firebase Client SDK without Firebase Cloud Functions or a dedicated cloud backend:

1. **Client-Side Spin Randomness:**
   - In a browser-only environment, prize selection and wheel physics are executed in the visitor's browser engine (`js/spin.js`).
   - While the algorithm uses weighted probabilities, a determined technical user opening Chrome DevTools could inspect or manipulate client-side variables prior to database persistence.
2. **Promotional Demo Credits:**
   - Because client-side execution cannot guarantee cryptographic non-tampering without server-side execution, all prize amounts are explicitly designated as **promotional demonstration credits**.
   - The platform clearly displays disclaimers that claim submissions register an inquiry for administrative review and do **not** represent automatic cash transfers.
3. **Path to Cryptographically Guaranteed Cash Payouts:**
   - If you later decide to disburse real funded monetary payouts, implement a **Firebase Cloud Function** or Node.js server endpoint using the Firebase Admin SDK:
     - The client calls `httpsCallable('generateSecureSpin')`.
     - The server determines the prize using secure CSPRNG (`crypto.randomInt`), records the winning document in Firestore with a server timestamp, signs a JWT token, and returns the result to the client to animate the wheel.
     - UPI reward redemption is then strictly processed through authenticated payout webhooks (e.g. RazorpayX, Cashfree Payouts, or bank API).
