/**
 * Firebase SDK Modular Configuration & Integration Hub
 * Pure HTML5 / JavaScript (ES Module)
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  serverTimestamp, 
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadString,
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ============================================================================
// 1. FIREBASE CONFIGURATION OBJECT
// Configured for project: spin-win-project
// ============================================================================
export const firebaseConfig = window.CUSTOM_FIREBASE_CONFIG || {
  apiKey: "AIzaSyC1JksCTob3MMm9KIr-Apr0g8dWLopI54c",
  authDomain: "spin-win-project.firebaseapp.com",
  projectId: "spin-win-project",
  storageBucket: "spin-win-project.firebasestorage.app",
  messagingSenderId: "420283679910",
  appId: "1:420283679910:web:7359fde469092780082067",
  measurementId: "G-CB34DD16N0"
};

// Check if credentials are valid
export function isFirebaseConfigured() {
  return firebaseConfig && 
    firebaseConfig.apiKey && 
    firebaseConfig.apiKey.startsWith("AIzaSy") &&
    firebaseConfig.projectId === "spin-win-project";
}

// Initialize Firebase App
let app = null;
let db = null;
let auth = null;
let storage = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log("🔥 [Firebase] Successfully connected to live Firestore & Auth:", firebaseConfig.projectId);
  } catch (err) {
    console.warn("⚠️ [Firebase] Live initialization error (fallback enabled):", err.message);
  }
} else {
  console.info("ℹ️ [Firebase] Configuration placeholder detected. Local simulation mode active for testing.");
}

export { app, db, auth, storage };
export { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  serverTimestamp, 
  onSnapshot 
};
export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged 
};
export { 
  ref, 
  uploadBytes, 
  uploadString, 
  getDownloadURL 
};

// ============================================================================
// 2. VISITOR IDENTIFIER (PARTICIPANT ID)
// Persistent client identifier stored in localStorage
// ============================================================================
export function getOrCreateParticipantId() {
  const STORAGE_KEY = 'spin_win_participant_id';
  let participantId = localStorage.getItem(STORAGE_KEY);
  if (!participantId) {
    const timestamp = Date.now().toString(36);
    const randomSalt = Math.random().toString(36).substring(2, 8).toUpperCase();
    participantId = `PART-${timestamp}-${randomSalt}`;
    localStorage.setItem(STORAGE_KEY, participantId);
  }
  return participantId;
}

// ============================================================================
// 3. FIRESTORE DATABASE SERVICE WITH HYBRID LOCAL/CLOUD FALLBACK
// Enables seamless testing both before and after Firebase credentials are bound!
// ============================================================================

const LOCAL_STORAGE_DB_PREFIX = 'spin_win_db_';

function getLocalCollection(collectionName) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DB_PREFIX + collectionName);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalCollection(collectionName, items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_DB_PREFIX + collectionName, JSON.stringify(items));
  } catch (e) {
    console.warn("Local storage write failed:", e);
  }
}

/**
 * Record a Spin Result
 * Collection: spin_results
 */
export async function saveSpinResult(spinData) {
  const docPayload = {
    spinId: spinData.spinId,
    prizeAmount: spinData.prizeAmount,
    resultStatus: spinData.resultStatus || 'completed',
    createdAt: new Date().toISOString(),
    participantId: spinData.participantId
  };

  // Always keep local copy for instant dashboard testing
  const localList = getLocalCollection('spin_results');
  localList.unshift(docPayload);
  saveLocalCollection('spin_results', localList);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'spin_results'), {
        ...docPayload,
        serverCreatedAt: serverTimestamp()
      });
      console.log("Firestore [spin_results] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [spin_results] error:", err);
      return { success: true, id: spinData.spinId, isLive: false, error: err.message };
    }
  }

  return { success: true, id: spinData.spinId, isLive: false };
}

/**
 * Record a Reward Claim
 * Collection: reward_claims
 */
export async function saveRewardClaim(claimData) {
  const docPayload = {
    claimId: claimData.claimId,
    spinId: claimData.spinId,
    upiId: claimData.upiId,
    participantId: claimData.participantId,
    claimStatus: claimData.claimStatus || 'pending',
    submittedAt: new Date().toISOString()
  };

  const localList = getLocalCollection('reward_claims');
  localList.unshift(docPayload);
  saveLocalCollection('reward_claims', localList);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'reward_claims'), {
        ...docPayload,
        serverSubmittedAt: serverTimestamp()
      });
      console.log("Firestore [reward_claims] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [reward_claims] error:", err);
      return { success: true, id: claimData.claimId, isLive: false, error: err.message };
    }
  }

  return { success: true, id: claimData.claimId, isLive: false };
}

/**
 * Record Consent History
 * Collection: consent_records
 */
export async function saveConsentRecord(consentData) {
  const docPayload = {
    participantId: consentData.participantId,
    locationConsent: !!consentData.locationConsent,
    cameraConsent: !!consentData.cameraConsent,
    galleryConsent: !!consentData.galleryConsent,
    upiConsent: !!consentData.upiConsent,
    action: consentData.action || 'granted', // 'granted' | 'withdrawn' | 'updated'
    consentTimestamp: new Date().toISOString()
  };

  const localList = getLocalCollection('consent_records');
  localList.unshift(docPayload);
  saveLocalCollection('consent_records', localList);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'consent_records'), {
        ...docPayload,
        serverTimestamp: serverTimestamp()
      });
      console.log("Firestore [consent_records] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [consent_records] error:", err);
      return { success: true, isLive: false, error: err.message };
    }
  }

  return { success: true, isLive: false };
}

/**
 * Record Visitor Location
 * Collection: visitor_locations
 */
export async function saveVisitorLocation(locationData) {
  const docPayload = {
    participantId: locationData.participantId,
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    accuracy: locationData.accuracy !== undefined ? locationData.accuracy : null,
    mapsUrl: `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`,
    capturedAt: new Date().toISOString()
  };

  const localList = getLocalCollection('visitor_locations');
  localList.unshift(docPayload);
  saveLocalCollection('visitor_locations', localList);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'visitor_locations'), {
        ...docPayload,
        serverCapturedAt: serverTimestamp()
      });
      console.log("Firestore [visitor_locations] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [visitor_locations] error:", err);
      return { success: true, isLive: false, error: err.message };
    }
  }

  return { success: true, isLive: false };
}

/**
 * Record Visitor Uploads
 * Collection: visitor_uploads
 */
export async function saveVisitorUpload(uploadData) {
  const docPayload = {
    participantId: uploadData.participantId,
    fileReference: uploadData.fileReference,
    uploadType: uploadData.uploadType, // 'camera_capture' | 'gallery_upload'
    uploadedAt: new Date().toISOString()
  };

  const localList = getLocalCollection('visitor_uploads');
  localList.unshift(docPayload);
  saveLocalCollection('visitor_uploads', localList);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'visitor_uploads'), {
        ...docPayload,
        serverUploadedAt: serverTimestamp()
      });
      console.log("Firestore [visitor_uploads] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [visitor_uploads] error:", err);
      return { success: true, isLive: false, error: err.message };
    }
  }

  return { success: true, isLive: false };
}

/**
 * Fetch all records for Dashboard (handles Firestore + local cache merger)
 */
export async function fetchCollectionData(collectionName) {
  const localItems = getLocalCollection(collectionName);

  if (db && isFirebaseConfigured()) {
    try {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);
      const firestoreItems = [];
      snapshot.forEach(docSnap => {
        firestoreItems.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      return firestoreItems;
    } catch (err) {
      console.warn(`Firestore read failed for [${collectionName}]:`, err.message);
      return localItems;
    }
  }

  return localItems;
}

/**
 * Update Claim Status in Firestore & Local
 */
export async function updateClaimStatus(claimId, newStatus) {
  // Update local copy
  const claims = getLocalCollection('reward_claims');
  const index = claims.findIndex(c => c.claimId === claimId || c.id === claimId);
  if (index !== -1) {
    claims[index].claimStatus = newStatus;
    saveLocalCollection('reward_claims', claims);
  }

  if (db && isFirebaseConfigured()) {
    try {
      // Find document by claimId field or doc id
      const q = query(collection(db, 'reward_claims'), where('claimId', '==', claimId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, { claimStatus: newStatus });
      }
      return { success: true };
    } catch (err) {
      console.error("Failed to update claim in Firestore:", err);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}
