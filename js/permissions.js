/**
 * Permission Management, Device Camera Control, Geolocation & User Consent
 * Implements granular, privacy-respecting and independent permissions.
 */

import { 
  saveVisitorLocation, 
  saveConsentRecord, 
  getOrCreateParticipantId 
} from './firebase-config.js';
import { uploadCameraCapture, uploadGalleryImage } from './uploads.js';

// Local permission state cache
const consentState = {
  location: false,
  camera: false,
  gallery: false,
  upi: false
};

// Camera hardware state
let activeCameraStream = null;
let capturedSnapshotDataUrl = null;

// Selected Gallery File
let selectedGalleryFile = null;

/**
 * Open Permissions Modal
 */
export function openPermissionsModal() {
  const modal = document.getElementById('permissions-modal');
  if (!modal) return;

  refreshConsentUI();
  modal.classList.add('active');
}

/**
 * Close Permissions Modal
 */
export function closePermissionsModal() {
  // Safety: Shut off active camera hardware before closing
  stopCameraStream();

  const modal = document.getElementById('permissions-modal');
  if (modal) modal.classList.remove('active');
}

// ============================================================================
// 1. GEOLOCATION PERMISSION FLOW
// ============================================================================
export async function requestLocationPermission() {
  const statusBadge = document.getElementById('loc-status-badge');
  const detailsEl = document.getElementById('loc-details');
  const allowBtn = document.getElementById('loc-allow-btn');

  if (!navigator.geolocation) {
    if (window.showToast) window.showToast("Geolocation is not supported by your browser.", "error");
    return;
  }

  if (allowBtn) {
    allowBtn.disabled = true;
    allowBtn.innerText = "Requesting...";
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const participantId = getOrCreateParticipantId();

      // 1. Save to Firestore collection visitor_locations
      await saveVisitorLocation({
        participantId: participantId,
        latitude: parseFloat(latitude.toFixed(6)),
        longitude: parseFloat(longitude.toFixed(6))
      });

      // 2. Save consent record
      consentState.location = true;
      await saveConsentRecord({
        participantId: participantId,
        locationConsent: true,
        action: 'granted'
      });

      // Update UI
      if (statusBadge) {
        statusBadge.className = 'perm-status-badge granted';
        statusBadge.innerText = 'Granted';
      }
      if (detailsEl) {
        detailsEl.innerHTML = `<span style="color:#10B981">✓ Location shared:</span> ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
      }
      if (allowBtn) {
        allowBtn.style.display = 'none';
      }

      refreshConsentUI();
      if (window.showToast) window.showToast("Location permission granted and recorded.", "success");
    },
    (err) => {
      console.warn("Location permission denied or unavailable:", err.message);
      if (allowBtn) {
        allowBtn.disabled = false;
        allowBtn.innerText = "Allow Location";
      }
      if (detailsEl) {
        detailsEl.innerHTML = `<span style="color:#F87171">Location access was declined or timed out.</span>`;
      }
      if (window.showToast) window.showToast("Location access not granted.", "warning");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

// ============================================================================
// 2. CAMERA PERMISSION & CAPTURE FLOW
// ============================================================================
export async function startCamera() {
  const cameraBox = document.getElementById('camera-box');
  const videoEl = document.getElementById('camera-video');
  const previewImg = document.getElementById('camera-preview-img');
  const startBtn = document.getElementById('cam-start-btn');
  const facingSelect = document.getElementById('cam-facing-select');
  const liveControls = document.getElementById('cam-live-controls');
  const captureReviewControls = document.getElementById('cam-review-controls');

  const facingMode = facingSelect ? facingSelect.value : 'user';

  // Stop any prior stream
  stopCameraStream();

  try {
    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    activeCameraStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (videoEl) {
      videoEl.srcObject = activeCameraStream;
      videoEl.style.display = 'block';
      await videoEl.play();
    }

    if (previewImg) previewImg.style.display = 'none';
    if (cameraBox) cameraBox.classList.add('active');
    if (startBtn) startBtn.style.display = 'none';
    if (liveControls) liveControls.style.display = 'flex';
    if (captureReviewControls) captureReviewControls.style.display = 'none';

  } catch (err) {
    console.error("Camera access error:", err);
    if (window.showToast) {
      window.showToast("Unable to access camera: " + err.message, "error");
    }
  }
}

export function captureSnapshot() {
  const videoEl = document.getElementById('camera-video');
  const previewImg = document.getElementById('camera-preview-img');
  const liveControls = document.getElementById('cam-live-controls');
  const captureReviewControls = document.getElementById('cam-review-controls');

  if (!videoEl || !videoEl.videoWidth) return;

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  capturedSnapshotDataUrl = canvas.toDataURL('image/jpeg', 0.9);

  // Stop camera stream immediately upon capture for battery & privacy
  stopCameraStream();

  // Show snapshot preview
  if (videoEl) videoEl.style.display = 'none';
  if (previewImg) {
    previewImg.src = capturedSnapshotDataUrl;
    previewImg.style.display = 'block';
  }

  if (liveControls) liveControls.style.display = 'none';
  if (captureReviewControls) captureReviewControls.style.display = 'flex';
}

export function retakeSnapshot() {
  capturedSnapshotDataUrl = null;
  startCamera();
}

export function deleteSnapshot() {
  capturedSnapshotDataUrl = null;
  stopCameraStream();

  const cameraBox = document.getElementById('camera-box');
  const startBtn = document.getElementById('cam-start-btn');
  const liveControls = document.getElementById('cam-live-controls');
  const captureReviewControls = document.getElementById('cam-review-controls');

  if (cameraBox) cameraBox.classList.remove('active');
  if (startBtn) startBtn.style.display = 'inline-flex';
  if (liveControls) liveControls.style.display = 'none';
  if (captureReviewControls) captureReviewControls.style.display = 'none';
}

export async function confirmSaveSnapshot() {
  if (!capturedSnapshotDataUrl) return;

  const confirmBtn = document.getElementById('cam-confirm-btn');
  const statusBadge = document.getElementById('cam-status-badge');
  const participantId = getOrCreateParticipantId();

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerText = "Saving...";
  }

  try {
    // 1. Upload to Storage & Firestore visitor_uploads
    await uploadCameraCapture(capturedSnapshotDataUrl);

    // 2. Record consent
    consentState.camera = true;
    await saveConsentRecord({
      participantId: participantId,
      cameraConsent: true,
      action: 'granted'
    });

    if (statusBadge) {
      statusBadge.className = 'perm-status-badge granted';
      statusBadge.innerText = 'Photo Uploaded';
    }

    deleteSnapshot();
    refreshConsentUI();

    if (window.showToast) window.showToast("Winner photo uploaded successfully!", "success");

  } catch (err) {
    console.error("Failed to save snapshot:", err);
    if (window.showToast) window.showToast("Photo upload failed: " + err.message, "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerText = "Confirm & Save Photo";
    }
  }
}

export function stopCameraStream() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => {
      track.stop();
    });
    activeCameraStream = null;
  }
}

// ============================================================================
// 3. GALLERY IMAGE SELECTION FLOW
// ============================================================================
export function handleGallerySelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  selectedGalleryFile = file;

  const previewWrap = document.getElementById('gallery-preview-wrap');
  const previewThumb = document.getElementById('gallery-preview-thumb');
  const previewName = document.getElementById('gallery-preview-name');
  const previewSize = document.getElementById('gallery-preview-size');
  const uploadBtn = document.getElementById('gallery-upload-btn');

  if (previewThumb) {
    const objectUrl = URL.createObjectURL(file);
    previewThumb.src = objectUrl;
  }

  if (previewName) previewName.innerText = file.name;
  if (previewSize) previewSize.innerText = `${(file.size / 1024).toFixed(1)} KB`;

  if (previewWrap) previewWrap.classList.add('active');
  if (uploadBtn) uploadBtn.style.display = 'inline-flex';
}

export async function confirmUploadGalleryImage() {
  if (!selectedGalleryFile) return;

  const uploadBtn = document.getElementById('gallery-upload-btn');
  const statusBadge = document.getElementById('gallery-status-badge');
  const participantId = getOrCreateParticipantId();

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerText = "Uploading...";
  }

  try {
    // Upload image
    await uploadGalleryImage(selectedGalleryFile);

    // Save consent
    consentState.gallery = true;
    await saveConsentRecord({
      participantId: participantId,
      galleryConsent: true,
      action: 'granted'
    });

    if (statusBadge) {
      statusBadge.className = 'perm-status-badge granted';
      statusBadge.innerText = 'Uploaded';
    }

    if (uploadBtn) uploadBtn.style.display = 'none';

    refreshConsentUI();
    if (window.showToast) window.showToast("Gallery image uploaded successfully!", "success");

  } catch (err) {
    console.error("Gallery upload error:", err);
    if (window.showToast) window.showToast(err.message, "error");
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerText = "Confirm & Upload";
    }
  }
}

// ============================================================================
// 4. CONSENT WITHDRAWAL & SUMMARY
// ============================================================================
export async function withdrawAllConsents() {
  const participantId = getOrCreateParticipantId();

  consentState.location = false;
  consentState.camera = false;
  consentState.gallery = false;
  consentState.upi = false;

  await saveConsentRecord({
    participantId: participantId,
    locationConsent: false,
    cameraConsent: false,
    galleryConsent: false,
    upiConsent: false,
    action: 'withdrawn'
  });

  // Reset status badges
  ['loc-status-badge', 'cam-status-badge', 'gallery-status-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = 'perm-status-badge';
      el.innerText = 'Optional';
    }
  });

  refreshConsentUI();
  if (window.showToast) window.showToast("All optional consents withdrawn.", "warning");
}

function refreshConsentUI() {
  const summaryEl = document.getElementById('consent-summary-badges');
  if (!summaryEl) return;

  summaryEl.innerHTML = `
    <span class="status-pill ${consentState.location ? 'approved' : 'pending'}">Location: ${consentState.location ? 'Shared' : 'Not Shared'}</span>
    <span class="status-pill ${consentState.camera ? 'approved' : 'pending'}">Camera: ${consentState.camera ? 'Uploaded' : 'Not Uploaded'}</span>
    <span class="status-pill ${consentState.gallery ? 'approved' : 'pending'}">Gallery: ${consentState.gallery ? 'Uploaded' : 'Not Uploaded'}</span>
  `;
}

// Global hooks
window.openPermissionsModal = openPermissionsModal;
window.closePermissionsModal = closePermissionsModal;
window.requestLocationPermission = requestLocationPermission;
window.startCamera = startCamera;
window.captureSnapshot = captureSnapshot;
window.retakeSnapshot = retakeSnapshot;
window.deleteSnapshot = deleteSnapshot;
window.confirmSaveSnapshot = confirmSaveSnapshot;
window.handleGallerySelection = handleGallerySelection;
window.confirmUploadGalleryImage = confirmUploadGalleryImage;
window.withdrawAllConsents = withdrawAllConsents;
