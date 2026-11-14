/**
 * UPI Reward Claim Flow & Verification Handling
 * Pure Vanilla JavaScript
 */

import { 
  saveRewardClaim, 
  saveConsentRecord, 
  getOrCreateParticipantId 
} from './firebase-config.js';

// Standard NPCI / Banking UPI ID Pattern (e.g. user@okaxis, 9876543210@paytm)
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

let currentClaimSpinId = null;
let currentClaimPrize = null;

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

    // 3. Close UPI Modal & show Clean Success confirmation
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

// Global hooks for cross-module access
window.openRewardClaimModal = openRewardClaimModal;
window.closeRewardClaimModal = closeRewardClaimModal;
window.handleUpiSubmission = handleUpiSubmission;
window.handleSkipUpiClaim = handleSkipUpiClaim;
window.showSuccessModal = showSuccessModal;
