/**
 * Admin Dashboard Controller
 * Real-time Analytics, Claim Management, Permissions Audit & Data Export
 */

import { 
  db,
  auth, 
  signOut, 
  onAuthStateChanged, 
  fetchCollectionData, 
  updateClaimStatus, 
  isFirebaseConfigured, 
  collection,
  onSnapshot,
  firebaseConfig 
} from './firebase-config.js';

// State caches for filtering & exports
let allSpins = [];
let allClaims = [];
let allLocations = [];
let allUploads = [];
let allConsents = [];

let currentTab = 'spins';
let activeSearchQuery = '';
let activePrizeFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  checkAuthAndInit();

  // 2. Setup Navigation Tabs
  initTabs();

  // 3. Setup Filters & Search
  initFilters();

  // 4. Setup Logout Button
  const logoutBtn = document.getElementById('dash-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // 5. Setup Manual Refresh
  const refreshBtn = document.getElementById('dash-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAllDashboardData);
  }

  // 6. Setup CSV Export Button
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportActiveTabToCSV);
  }

  // 7. Check if setup guide should be visible
  checkSetupStatus();
});

let realTimeListenersInitialized = false;

function setupRealtimeListeners() {
  if (realTimeListenersInitialized || !db || !isFirebaseConfigured()) return;
  realTimeListenersInitialized = true;
  console.log("⚡ [Dashboard] Real-Time Firestore Synchronization active!");

  try {
    // 1. Live Accurate Locations
    onSnapshot(collection(db, 'visitor_locations'), (snapshot) => {
      allLocations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      allLocations.sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));
      computeAndRenderMetrics();
      if (currentTab === 'locations') renderLocationsTable();
    });

    // 2. Live Uploads (Front & Back Camera Snapshots)
    onSnapshot(collection(db, 'visitor_uploads'), (snapshot) => {
      allUploads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      allUploads.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
      computeAndRenderMetrics();
      if (currentTab === 'uploads') renderUploadsGrid();
    });

    // 3. Live Claims
    onSnapshot(collection(db, 'reward_claims'), (snapshot) => {
      allClaims = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      allClaims.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
      computeAndRenderMetrics();
      if (currentTab === 'claims') renderClaimsTable();
    });

    // 4. Live Spins
    onSnapshot(collection(db, 'spin_results'), (snapshot) => {
      allSpins = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      allSpins.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      computeAndRenderMetrics();
      if (currentTab === 'spins') renderSpinsTable();
    });

    // 5. Live Consents
    onSnapshot(collection(db, 'consent_records'), (snapshot) => {
      allConsents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      allConsents.sort((a, b) => new Date(b.consentTimestamp || 0) - new Date(a.consentTimestamp || 0));
      computeAndRenderMetrics();
      if (currentTab === 'consents') renderConsentsTable();
    });
  } catch (err) {
    console.warn("Real-time listener initialization fallback:", err);
  }
}

function checkAuthAndInit() {
  const adminEmail = sessionStorage.getItem('spin_admin_email');
  const adminSession = sessionStorage.getItem('spin_admin_session');

  if (auth && isFirebaseConfigured()) {
    onAuthStateChanged(auth, (user) => {
      if (!user && !adminSession) {
        window.location.href = 'login.html';
      } else {
        const userEmailEl = document.getElementById('admin-display-email');
        if (userEmailEl) userEmailEl.innerText = (user && user.email) || adminEmail || 'Administrator';
        loadAllDashboardData();
        setupRealtimeListeners();
      }
    });
  } else {
    // Demo / fallback mode check
    if (!adminSession) {
      window.location.href = 'login.html';
    } else {
      const userEmailEl = document.getElementById('admin-display-email');
      if (userEmailEl) userEmailEl.innerText = `${adminEmail || 'admin@spinwin.local'} (Demo Mode)`;
      loadAllDashboardData();
    }
  }
}

async function handleLogout() {
  if (auth && isFirebaseConfigured()) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out error:", e);
    }
  }
  sessionStorage.removeItem('spin_admin_session');
  sessionStorage.removeItem('spin_admin_email');
  window.location.href = 'login.html';
}

function checkSetupStatus() {
  const guide = document.getElementById('firebase-setup-guide');
  if (!guide) return;
  if (!isFirebaseConfigured()) {
    guide.classList.add('visible');
  } else {
    guide.classList.remove('visible');
  }
}

// ============================================================================
// DATA LOADING & METRICS COMPUTATION
// ============================================================================
export async function loadAllDashboardData() {
  const refreshBtn = document.getElementById('dash-refresh-btn');
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    // Parallel fetch from Firestore / Local Collections
    const [spins, claims, locations, uploads, consents] = await Promise.all([
      fetchCollectionData('spin_results'),
      fetchCollectionData('reward_claims'),
      fetchCollectionData('visitor_locations'),
      fetchCollectionData('visitor_uploads'),
      fetchCollectionData('consent_records')
    ]);

    allSpins = spins || [];
    allClaims = claims || [];
    allLocations = locations || [];
    allUploads = uploads || [];
    allConsents = consents || [];

    // Sort newest first
    allSpins.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    allClaims.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    allLocations.sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));
    allUploads.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    allConsents.sort((a, b) => new Date(b.consentTimestamp || 0) - new Date(a.consentTimestamp || 0));

    // Update Statistics Cards
    computeAndRenderMetrics();

    // Render active tab view
    renderActiveTab();

  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

function computeAndRenderMetrics() {
  // 1. Unique Participants
  const participantSet = new Set();
  allSpins.forEach(s => s.participantId && participantSet.add(s.participantId));
  const totalParticipants = participantSet.size;

  // 2. Spins
  const totalSpins = allSpins.length;

  // 3. Claims
  const totalClaims = allClaims.length;
  const pendingClaims = allClaims.filter(c => (c.claimStatus || 'pending').toLowerCase() === 'pending').length;
  const upiCount = allClaims.filter(c => !!c.upiId).length;

  // 4. ₹1,000 and ₹10,000 winners
  const wins1000 = allSpins.filter(s => String(s.prizeAmount).includes('1,000') && !String(s.prizeAmount).includes('10,000')).length;
  const wins10000 = allSpins.filter(s => String(s.prizeAmount).includes('10,000')).length;

  // 5. Consents
  const locationConsents = allLocations.length;
  const cameraUploads = allUploads.filter(u => ['camera_capture', 'front_camera', 'back_camera'].includes(u.uploadType)).length;
  const galleryUploads = allUploads.filter(u => u.uploadType === 'gallery_upload').length;

  // Update DOM metrics
  setText('metric-total-participants', totalParticipants);
  setText('metric-total-spins', totalSpins);
  setText('metric-total-claims', totalClaims);
  setText('metric-pending-claims', pendingClaims);
  setText('metric-upi-ids', upiCount);
  setText('metric-wins-1000', wins1000);
  setText('metric-wins-10000', wins10000);
  setText('metric-loc-consents', locationConsents);
  setText('metric-cam-consents', cameraUploads);
  setText('metric-gallery-uploads', galleryUploads);

  // Update tab badge counters
  setText('badge-tab-spins', totalSpins);
  setText('badge-tab-claims', totalClaims);
  setText('badge-tab-locations', allLocations.length);
  setText('badge-tab-uploads', allUploads.length);
  setText('badge-tab-consents', allConsents.length);

  // Compute Prize Breakdown
  const prizeCounts = {
    '₹10': 0, '₹50': 0, '₹100': 0, '₹200': 0, '₹500': 0,
    '₹1,000': 0, '₹2,000': 0, '₹5,000': 0, '₹10,000': 0, 'Better Luck': 0
  };

  allSpins.forEach(s => {
    const p = String(s.prizeAmount || '');
    if (p.includes('10,000')) prizeCounts['₹10,000']++;
    else if (p.includes('1,000')) prizeCounts['₹1,000']++;
    else if (p.includes('5,000')) prizeCounts['₹5,000']++;
    else if (p.includes('2,000')) prizeCounts['₹2,000']++;
    else if (p.includes('500')) prizeCounts['₹500']++;
    else if (p.includes('200')) prizeCounts['₹200']++;
    else if (p.includes('100')) prizeCounts['₹100']++;
    else if (p.includes('50')) prizeCounts['₹50']++;
    else if (p.includes('10')) prizeCounts['₹10']++;
    else prizeCounts['Better Luck']++;
  });

  for (let key in prizeCounts) {
    const slug = key.replace(/[^a-zA-Z0-9]/g, '');
    setText(`prize-count-${slug}`, prizeCounts[key]);
  }
}

function setText(elementId, val) {
  const el = document.getElementById(elementId);
  if (el) el.innerText = val;
}

// ============================================================================
// TAB NAVIGATION & FILTERING
// ============================================================================
function initTabs() {
  const tabButtons = document.querySelectorAll('.dash-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab');

      // Toggle views
      document.querySelectorAll('.tab-view-content').forEach(view => {
        view.style.display = 'none';
      });

      const activeView = document.getElementById(`tab-view-${currentTab}`);
      if (activeView) activeView.style.display = 'block';

      renderActiveTab();
    });
  });
}

function initFilters() {
  const searchInput = document.getElementById('dash-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.trim().toLowerCase();
      renderActiveTab();
    });
  }

  const prizeFilter = document.getElementById('dash-prize-filter');
  if (prizeFilter) {
    prizeFilter.addEventListener('change', (e) => {
      activePrizeFilter = e.target.value;
      renderActiveTab();
    });
  }
}

function renderActiveTab() {
  switch (currentTab) {
    case 'spins':
      renderSpinsTable();
      break;
    case 'claims':
      renderClaimsTable();
      break;
    case 'locations':
      renderLocationsTable();
      break;
    case 'uploads':
      renderUploadsGrid();
      break;
    case 'consents':
      renderConsentsTable();
      break;
  }
}

// ============================================================================
// TAB 1: SPIN HISTORY TABLE
// ============================================================================
function renderSpinsTable() {
  const tbody = document.getElementById('spins-table-body');
  if (!tbody) return;

  let filtered = allSpins.filter(s => {
    const matchesSearch = !activeSearchQuery || 
      (s.spinId && s.spinId.toLowerCase().includes(activeSearchQuery)) ||
      (s.participantId && s.participantId.toLowerCase().includes(activeSearchQuery)) ||
      (s.prizeAmount && s.prizeAmount.toLowerCase().includes(activeSearchQuery));

    const matchesPrize = activePrizeFilter === 'ALL' || 
      (s.prizeAmount && s.prizeAmount.includes(activePrizeFilter));

    return matchesSearch && matchesPrize;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table-state"><div class="empty-state-icon">🎰</div>No spin records found matching your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td>
        <span class="code-badge">${escapeHtml(item.spinId || 'N/A')}
          <button class="copy-mini-btn" onclick="navigator.clipboard.writeText('${item.spinId || ''}')" title="Copy ID">📋</button>
        </span>
      </td>
      <td>
        <strong style="color: ${item.prizeAmount?.includes('10,000') ? '#FFD700' : item.prizeAmount?.includes('1,000') ? '#FFA800' : '#FFF'}">
          ${escapeHtml(item.prizeAmount || 'N/A')}
        </strong>
      </td>
      <td>${formatDateTime(item.createdAt)}</td>
      <td><span class="code-badge" style="color:#B3B7D0">${escapeHtml(item.participantId || 'N/A')}</span></td>
      <td><span class="status-pill ${item.resultStatus === 'claimed' ? 'approved' : item.resultStatus === 'unclaimed' ? 'pending' : 'completed'}">${escapeHtml(item.resultStatus || 'completed')}</span></td>
    </tr>
  `).join('');
}

// ============================================================================
// TAB 2: REWARD CLAIMS TABLE
// ============================================================================
function renderClaimsTable() {
  const tbody = document.getElementById('claims-table-body');
  if (!tbody) return;

  let filtered = allClaims.filter(c => {
    return !activeSearchQuery || 
      (c.claimId && c.claimId.toLowerCase().includes(activeSearchQuery)) ||
      (c.spinId && c.spinId.toLowerCase().includes(activeSearchQuery)) ||
      (c.upiId && c.upiId.toLowerCase().includes(activeSearchQuery)) ||
      (c.participantId && c.participantId.toLowerCase().includes(activeSearchQuery));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-state"><div class="empty-state-icon">💸</div>No reward claim requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td><span class="code-badge">${escapeHtml(item.claimId || 'N/A')}</span></td>
      <td><span class="code-badge">${escapeHtml(item.spinId || 'N/A')}</span></td>
      <td>
        <strong style="color:#00F5D4; font-family:var(--font-mono)">${escapeHtml(item.upiId || 'N/A')}</strong>
        <button class="copy-mini-btn" onclick="navigator.clipboard.writeText('${item.upiId || ''}')" title="Copy UPI">📋</button>
      </td>
      <td>
        <span class="status-pill ${item.claimStatus === 'approved' ? 'approved' : item.claimStatus === 'rejected' ? 'rejected' : 'pending'}">
          ${escapeHtml(item.claimStatus || 'pending')}
        </span>
      </td>
      <td>${formatDateTime(item.submittedAt)}</td>
      <td>
        <div class="table-actions">
          <button class="btn-table-action approve" onclick="window.changeClaimStatus('${item.claimId || item.id}', 'approved')">Approve</button>
          <button class="btn-table-action reject" onclick="window.changeClaimStatus('${item.claimId || item.id}', 'rejected')">Reject</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.changeClaimStatus = async function(claimId, status) {
  if (!confirm(`Are you sure you want to mark claim ${claimId} as ${status.toUpperCase()}?`)) return;
  await updateClaimStatus(claimId, status);
  await loadAllDashboardData();
};

// ============================================================================
// TAB 3: LOCATION RECORDS TABLE
// ============================================================================
function renderLocationsTable() {
  const tbody = document.getElementById('locations-table-body');
  if (!tbody) return;

  let filtered = allLocations.filter(loc => {
    return !activeSearchQuery ||
      (loc.participantId && loc.participantId.toLowerCase().includes(activeSearchQuery));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table-state"><div class="empty-state-icon">📍</div>No visitor locations shared yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td><span class="code-badge">${escapeHtml(item.participantId || 'N/A')}</span></td>
      <td>
        <strong style="color:#00F5D4; font-family:var(--font-mono)">
          ${item.latitude?.toFixed?.(6) || item.latitude}°, ${item.longitude?.toFixed?.(6) || item.longitude}°
        </strong>
      </td>
      <td>
        <span class="status-pill approved" style="font-size:0.75rem;">
          ${item.accuracy ? `±${item.accuracy}m (Accurate GPS)` : 'Accurate GPS'}
        </span>
      </td>
      <td>${formatDateTime(item.capturedAt)}</td>
      <td>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <a href="https://www.google.com/maps?q=${item.latitude},${item.longitude}" 
             target="_blank" rel="noopener noreferrer" class="btn btn-outline-gold" style="padding:0.3rem 0.65rem; font-size:0.75rem;">
             Google Maps ↗
          </a>
          <a href="https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=16/${item.latitude}/${item.longitude}" 
             target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="padding:0.3rem 0.65rem; font-size:0.75rem;">
             OSM ↗
          </a>
        </div>
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// TAB 4: UPLOADS GALLERY (Camera Snapshots & Uploads)
// ============================================================================
function renderUploadsGrid() {
  const grid = document.getElementById('uploads-grid-container');
  if (!grid) return;

  let filtered = allUploads.filter(u => {
    return !activeSearchQuery ||
      (u.participantId && u.participantId.toLowerCase().includes(activeSearchQuery));
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-table-state" style="grid-column: 1 / -1;"><div class="empty-state-icon">📷</div>No camera or gallery uploads submitted yet.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const isFront = item.uploadType === 'front_camera';
    const isBack = item.uploadType === 'back_camera';
    const badgeLabel = isFront ? '📸 Front Camera' : isBack ? '📷 Rear Camera' : item.uploadType === 'camera_capture' ? '📸 Camera Snapshot' : '🖼️ Gallery Image';
    const badgeColor = isFront ? '#38bdf8' : isBack ? '#c084fc' : '#34d399';

    return `
      <div class="upload-card">
        <div class="upload-card-thumb-wrap" onclick="window.openImageLightbox('${encodeURI(item.fileReference)}')">
          <img src="${escapeHtml(item.fileReference)}" alt="Visitor Camera Upload" loading="lazy">
          <span class="upload-card-badge" style="color: ${badgeColor}; border: 1px solid ${badgeColor}66;">
            ${badgeLabel}
          </span>
        </div>
        <div class="upload-card-body">
          <span class="upload-card-id" title="${escapeHtml(item.participantId || '')}">ID: ${escapeHtml(item.participantId || 'N/A')}</span>
          <span class="upload-card-date">${formatDateTime(item.uploadedAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.openImageLightbox = function(imgSrc) {
  const modal = document.getElementById('image-lightbox-modal');
  const modalImg = document.getElementById('lightbox-img');
  if (modal && modalImg) {
    modalImg.src = imgSrc;
    modal.classList.add('active');
  }
};

window.closeImageLightbox = function() {
  const modal = document.getElementById('image-lightbox-modal');
  if (modal) modal.classList.remove('active');
};

// ============================================================================
// TAB 5: CONSENT AUDIT HISTORY TABLE
// ============================================================================
function renderConsentsTable() {
  const tbody = document.getElementById('consents-table-body');
  if (!tbody) return;

  let filtered = allConsents.filter(c => {
    return !activeSearchQuery ||
      (c.participantId && c.participantId.toLowerCase().includes(activeSearchQuery));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-state"><div class="empty-state-icon">🛡️</div>No consent records logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td><span class="code-badge">${escapeHtml(item.participantId || 'N/A')}</span></td>
      <td><span class="status-pill ${item.locationConsent ? 'approved' : 'pending'}">${item.locationConsent ? 'Granted' : 'None'}</span></td>
      <td><span class="status-pill ${item.cameraConsent ? 'approved' : 'pending'}">${item.cameraConsent ? 'Granted' : 'None'}</span></td>
      <td><span class="status-pill ${item.galleryConsent ? 'approved' : 'pending'}">${item.galleryConsent ? 'Granted' : 'None'}</span></td>
      <td><span class="status-pill ${item.action === 'withdrawn' ? 'rejected' : 'approved'}">${escapeHtml(item.action || 'granted')}</span></td>
      <td>${formatDateTime(item.consentTimestamp)}</td>
    </tr>
  `).join('');
}

// ============================================================================
// CSV EXPORT ENGINE (Client-side RFC-4180 CSV builder)
// ============================================================================
function exportActiveTabToCSV() {
  let filename = `spin_win_${currentTab}_${Date.now()}.csv`;
  let rows = [];

  if (currentTab === 'spins') {
    rows.push(['Spin ID', 'Prize Amount', 'Date Time', 'Participant ID', 'Result Status']);
    allSpins.forEach(s => {
      rows.push([s.spinId || '', s.prizeAmount || '', s.createdAt || '', s.participantId || '', s.resultStatus || '']);
    });
  } else if (currentTab === 'claims') {
    rows.push(['Claim ID', 'Spin ID', 'UPI ID', 'Claim Status', 'Submission Date', 'Participant ID']);
    allClaims.forEach(c => {
      rows.push([c.claimId || '', c.spinId || '', c.upiId || '', c.claimStatus || '', c.submittedAt || '', c.participantId || '']);
    });
  } else if (currentTab === 'locations') {
    rows.push(['Participant ID', 'Latitude', 'Longitude', 'Captured At']);
    allLocations.forEach(l => {
      rows.push([l.participantId || '', l.latitude || '', l.longitude || '', l.capturedAt || '']);
    });
  } else if (currentTab === 'uploads') {
    rows.push(['Participant ID', 'Upload Type', 'Uploaded At', 'File Reference URL']);
    allUploads.forEach(u => {
      rows.push([u.participantId || '', u.uploadType || '', u.uploadedAt || '', u.fileReference || '']);
    });
  } else if (currentTab === 'consents') {
    rows.push(['Participant ID', 'Location Consent', 'Camera Consent', 'Gallery Consent', 'UPI Consent', 'Action', 'Timestamp']);
    allConsents.forEach(co => {
      rows.push([co.participantId || '', !!co.locationConsent, !!co.cameraConsent, !!co.galleryConsent, !!co.upiConsent, co.action || '', co.consentTimestamp || '']);
    });
  }

  const csvContent = rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helpers
function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
