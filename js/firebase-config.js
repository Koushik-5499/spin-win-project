/**
 * Firebase SDK Modular Configuration & Integration Hub
 * Pure HTML5 / JavaScript (ES Module)
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-analytics.js';
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
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
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
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadString,
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-storage.js';

// ============================================================================
// 1. FIREBASE CONFIGURATION OBJECT
// Configured for project: spin-win-project
// App ID: 1:420283679910:web:7359fde469092780082067
// ============================================================================
export const firebaseConfig = window.CUSTOM_FIREBASE_CONFIG || {
  apiKey: "AIzaSyC1JksCTob3MMm9KIr-Apr0g8dWLopI54c",
  authDomain: "spin-win-project.firebaseapp.com",
  databaseURL: "https://spin-win-project-default-rtdb.firebaseio.com",
  projectId: "spin-win-project",
  storageBucket: "spin-win-project.firebasestorage.app",
  messagingSenderId: "420283679910",
  appId: "1:420283679910:web:7359fde469092780082067",
  measurementId: "G-CB34DD16N0"
};

// Check if credentials are valid
export function isFirebaseConfigured() {
  return !!(firebaseConfig && 
    firebaseConfig.apiKey && 
    firebaseConfig.apiKey.startsWith("AIzaSy") &&
    firebaseConfig.projectId === "spin-win-project");
}

// Initialize Firebase App
let app = null;
let db = null;
let auth = null;
let storage = null;
let analytics = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    try {
      storage.maxUploadRetryTime = 4000;
      storage.maxOperationRetryTime = 4000;
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') {
        analytics = getAnalytics(app);
      }
    } catch (e) {
      // Analytics optional in local/cookie-restricted environments
    }
    console.log("🔥 [Firebase] Successfully initialized Firebase SDK:", firebaseConfig.projectId);
  } catch (err) {
    console.warn("⚠️ [Firebase] Live initialization error (fallback enabled):", err.message);
  }
} else {
  console.info("ℹ️ [Firebase] Configuration placeholder detected. Local simulation mode active for testing.");
}

export { app, db, auth, storage, analytics };
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
// 2. REAL-TIME CROSS-TAB NOTIFICATION SYSTEM
// Ensures dashboard updates instantly when any record is created across tabs
// ============================================================================
let realtimeChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    realtimeChannel = new BroadcastChannel('spin_win_realtime_channel');
  }
} catch (e) {
  console.warn("BroadcastChannel not available:", e);
}

export function notifyRealtimeChange(collectionName, data) {
  if (realtimeChannel) {
    try {
      realtimeChannel.postMessage({
        collection: collectionName,
        data: data,
        timestamp: Date.now()
      });
    } catch (e) {
      // Ignore broadcast errors
    }
  }

  // Also trigger custom window event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spin_win_data_update', {
      detail: { collection: collectionName, data: data }
    }));
  }
}

// ============================================================================
// 3. VISITOR IDENTIFIER (PARTICIPANT ID)
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
// 4. STORAGE ACCESS & LOCAL COLLECTIONS
// ============================================================================
const LOCAL_STORAGE_DB_PREFIX = 'spin_win_db_';

export function getLocalCollection(collectionName) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DB_PREFIX + collectionName);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalCollection(collectionName, items) {
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
    spinId: String(spinData.spinId || ''),
    prizeAmount: String(spinData.prizeAmount || ''),
    resultStatus: spinData.resultStatus || 'completed',
    createdAt: new Date().toISOString(),
    participantId: String(spinData.participantId || '')
  };

  // Always keep local copy for instant testing & synchronization
  const localList = getLocalCollection('spin_results');
  localList.unshift(docPayload);
  saveLocalCollection('spin_results', localList);
  notifyRealtimeChange('spin_results', docPayload);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'spin_results'), {
        ...docPayload,
        serverCreatedAt: serverTimestamp()
      });
      console.log("Firestore [spin_results] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [spin_results] write error:", err.message);
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
    claimId: String(claimData.claimId || ''),
    spinId: String(claimData.spinId || ''),
    upiId: String(claimData.upiId || ''),
    participantId: String(claimData.participantId || ''),
    claimStatus: claimData.claimStatus || 'pending',
    submittedAt: new Date().toISOString()
  };

  const localList = getLocalCollection('reward_claims');
  localList.unshift(docPayload);
  saveLocalCollection('reward_claims', localList);
  notifyRealtimeChange('reward_claims', docPayload);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'reward_claims'), {
        ...docPayload,
        serverSubmittedAt: serverTimestamp()
      });
      console.log("Firestore [reward_claims] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [reward_claims] write error:", err.message);
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
    participantId: String(consentData.participantId || ''),
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
  notifyRealtimeChange('consent_records', docPayload);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'consent_records'), {
        ...docPayload,
        serverTimestamp: serverTimestamp()
      });
      console.log("Firestore [consent_records] saved ID:", docRef.id);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [consent_records] write error:", err.message);
      return { success: true, isLive: false, error: err.message };
    }
  }

  return { success: true, isLive: false };
}

/**
 * Record Visitor Location
 * Collection: visitor_locations
 * STRICT SCHEMA:
 * - participantId (string)
 * - latitude (number, actual coordinates)
 * - longitude (number, actual coordinates)
 * - accuracy (number, meters)
 * - capturedAt (ISO string)
 * - consentStatus (string, 'granted')
 * NEVER SAVES 0,0 OR MISSING COORDINATES!
 */
export async function saveVisitorLocation(locationData) {
  const lat = typeof locationData.latitude === 'number' ? locationData.latitude : parseFloat(locationData.latitude);
  const lng = typeof locationData.longitude === 'number' ? locationData.longitude : parseFloat(locationData.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    throw new Error("Invalid location coordinates: latitude and longitude must be valid numbers.");
  }

  if (lat === 0 && lng === 0) {
    throw new Error("Invalid location coordinates: (0,0) is rejected as a default/placeholder location.");
  }

  const accuracy = (locationData.accuracy !== undefined && locationData.accuracy !== null) 
    ? Number(locationData.accuracy) 
    : null;

  const docPayload = {
    participantId: String(locationData.participantId || getOrCreateParticipantId()),
    latitude: lat,
    longitude: lng,
    accuracy: accuracy,
    capturedAt: locationData.capturedAt || new Date().toISOString(),
    consentStatus: locationData.consentStatus || 'granted'
  };

  // Local storage save for simulation & immediate dashboard sync
  const localList = getLocalCollection('visitor_locations');
  localList.unshift(docPayload);
  saveLocalCollection('visitor_locations', localList);
  notifyRealtimeChange('visitor_locations', docPayload);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'visitor_locations'), {
        ...docPayload,
        serverCapturedAt: serverTimestamp()
      });
      console.log("Firestore [visitor_locations] saved ID:", docRef.id, docPayload);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [visitor_locations] write error:", err.message);
      return { success: false, error: err.message, isLive: false };
    }
  }

  return { success: true, isLive: false };
}

/**
 * Record Visitor Uploads
 * Collection: visitor_uploads
 * STRICT SCHEMA:
 * - participantId (string)
 * - fileName (string)
 * - downloadURL (string)
 * - uploadType ('camera' or 'gallery')
 * - uploadedAt (ISO string)
 * - consentStatus (string, 'granted')
 * NEVER SAVES FAKE URL OR EMPTY IMAGE RECORD!
 */
export async function saveVisitorUpload(uploadData) {
  const downloadURL = uploadData.downloadURL || uploadData.fileReference;
  if (!downloadURL || typeof downloadURL !== 'string' || downloadURL.trim() === '') {
    throw new Error("Cannot save image record without a valid downloadURL.");
  }

  const uploadTypeRaw = String(uploadData.uploadType || 'camera').toLowerCase();
  const uploadType = (uploadTypeRaw.includes('gallery')) ? 'gallery' : 'camera';
  const fileName = String(uploadData.fileName || (uploadType === 'camera' ? 'selfie.jpg' : 'image.jpg'));
  const consentStatus = uploadData.consentStatus || 'granted';
  const uploadedAt = uploadData.uploadedAt || new Date().toISOString();
  const participantId = String(uploadData.participantId || getOrCreateParticipantId());

  const docPayload = {
    participantId: participantId,
    fileName: fileName,
    downloadURL: downloadURL,
    fileReference: downloadURL, // Preserved for backwards compatibility
    uploadType: uploadType,
    uploadedAt: uploadedAt,
    consentStatus: consentStatus
  };

  const localList = getLocalCollection('visitor_uploads');
  localList.unshift(docPayload);
  saveLocalCollection('visitor_uploads', localList);
  notifyRealtimeChange('visitor_uploads', docPayload);

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = await addDoc(collection(db, 'visitor_uploads'), {
        ...docPayload,
        serverUploadedAt: serverTimestamp()
      });
      console.log("Firestore [visitor_uploads] saved ID:", docRef.id, docPayload);
      return { success: true, id: docRef.id, isLive: true };
    } catch (err) {
      console.error("Firestore [visitor_uploads] write error:", err.message);
      return { success: false, error: err.message, isLive: false };
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

      // If firestore has items, merge with local to ensure nothing missed
      if (firestoreItems.length > 0) {
        const combined = [...firestoreItems];
        // Add local items not in firestore yet
        const existingIds = new Set(firestoreItems.map(f => f.spinId || f.claimId || f.id || `${f.participantId}_${f.capturedAt || f.uploadedAt}`));
        localItems.forEach(item => {
          const key = item.spinId || item.claimId || item.id || `${item.participantId}_${item.capturedAt || item.uploadedAt}`;
          if (!existingIds.has(key)) {
            combined.push(item);
          }
        });
        return combined;
      }
      return localItems;
    } catch (err) {
      console.warn(`Firestore read failed for [${collectionName}], using local data:`, err.message);
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
    notifyRealtimeChange('reward_claims', claims[index]);
  }

  if (db && isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'reward_claims'), where('claimId', '==', claimId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, { claimStatus: newStatus });
      }
      return { success: true };
    } catch (err) {
      console.error("Failed to update claim in Firestore:", err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}
