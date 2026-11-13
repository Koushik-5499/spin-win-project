/**
 * Media Upload Services (Firebase Storage + Client-Side Optimization)
 * Handles Camera Snapshot & Gallery File Verification
 */

import { 
  storage, 
  ref, 
  uploadBytes, 
  uploadString, 
  getDownloadURL, 
  saveVisitorUpload, 
  isFirebaseConfigured, 
  getOrCreateParticipantId 
} from './firebase-config.js';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB Limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Resize and compress an image file or dataURL using HTML5 canvas
 */
export async function optimizeImage(source, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(optimizedDataUrl);
    };
    img.onerror = (e) => reject(new Error("Image processing failed: " + e.message));

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    } else {
      reject(new Error("Invalid source format"));
    }
  });
}

/**
 * Upload a captured camera snapshot to Firebase Storage (or local storage fallback)
 */
export async function uploadCameraCapture(dataUrl) {
  const participantId = getOrCreateParticipantId();
  const timestamp = Date.now();
  const filename = `selfie_${participantId}_${timestamp}.jpg`;
  const storagePath = `visitor_uploads/${participantId}/${filename}`;

  // Compress image
  const compressedDataUrl = await optimizeImage(dataUrl, 1000, 0.85);

  let downloadUrl = compressedDataUrl;

  // Upload to Firebase Storage if available
  if (storage && isFirebaseConfigured()) {
    try {
      const fileRef = ref(storage, storagePath);
      // Upload DataURL as base64 string
      const uploadResult = await uploadString(fileRef, compressedDataUrl, 'data_url', {
        contentType: 'image/jpeg'
      });
      downloadUrl = await getDownloadURL(uploadResult.ref);
      console.log("Uploaded camera capture to Firebase Storage:", downloadUrl);
    } catch (err) {
      console.warn("Storage upload failed, using optimized base64 reference:", err.message);
      downloadUrl = compressedDataUrl;
    }
  }

  // Save reference in Firestore visitor_uploads
  await saveVisitorUpload({
    participantId: participantId,
    fileReference: downloadUrl,
    uploadType: 'camera_capture'
  });

  return { success: true, url: downloadUrl, type: 'camera_capture' };
}

/**
 * Upload a visitor-selected gallery file to Firebase Storage
 */
export async function uploadGalleryImage(file) {
  // Validate file
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Invalid file format. Please upload JPEG, PNG, or WEBP images only.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("File size exceeds 5 MB limit. Please select a smaller photo.");
  }

  const participantId = getOrCreateParticipantId();
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `visitor_uploads/${participantId}/gallery_${timestamp}_${sanitizedName}`;

  // Compress image before upload
  const compressedDataUrl = await optimizeImage(file, 1200, 0.85);

  let downloadUrl = compressedDataUrl;

  if (storage && isFirebaseConfigured()) {
    try {
      const fileRef = ref(storage, storagePath);
      const uploadResult = await uploadString(fileRef, compressedDataUrl, 'data_url', {
        contentType: 'image/jpeg'
      });
      downloadUrl = await getDownloadURL(uploadResult.ref);
      console.log("Uploaded gallery photo to Firebase Storage:", downloadUrl);
    } catch (err) {
      console.warn("Firebase Storage upload fallback:", err.message);
      downloadUrl = compressedDataUrl;
    }
  }

  // Save reference in Firestore visitor_uploads
  await saveVisitorUpload({
    participantId: participantId,
    fileReference: downloadUrl,
    uploadType: 'gallery_upload'
  });

  return { success: true, url: downloadUrl, type: 'gallery_upload' };
}
