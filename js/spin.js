/**
 * Wheel Drawing, Spin Physics, Audio Synthesizer & Result Handling
 * Pure HTML5 Canvas & Web Audio API
 */

import { saveSpinResult, getOrCreateParticipantId } from './firebase-config.js';

// ============================================================================
// 1. PRIZE SLICE DEFINITIONS (10 Slices)
// ============================================================================
export const PRIZES = [
  { text: "₹10", value: 10, bg: ["#1F1147", "#2D1B69"], color: "#E0AAFF", weight: 20 },
  { text: "₹50", value: 50, bg: ["#005F73", "#0A9396"], color: "#94D2BD", weight: 18 },
  { text: "₹100", value: 100, bg: ["#1D3557", "#457B9D"], color: "#A8DADC", weight: 15 },
  { text: "₹200", value: 200, bg: ["#1B4332", "#2D6A4F"], color: "#74C69D", weight: 12 },
  { text: "₹500", value: 500, bg: ["#4A0E4E", "#7209B7"], color: "#F72585", weight: 10 },
  { text: "₹1,000", value: 1000, bg: ["#7F5500", "#FFB703"], color: "#FFF8D6", isProminent: true, weight: 8 },
  { text: "₹2,000", value: 2000, bg: ["#6B0F1A", "#B91372"], color: "#FFB3C6", weight: 6 },
  { text: "₹5,000", value: 5000, bg: ["#10002B", "#3C096C"], color: "#C77DFF", weight: 4 },
  { text: "₹10,000", value: 10000, bg: ["#FFD700", "#FF8800"], color: "#1A0826", isProminent: true, isJackpot: true, weight: 2 },
  { text: "Better Luck", value: 0, bg: ["#2B2D42", "#4A4E69"], color: "#9A8C98", isBetterLuck: true, weight: 5 }
];

const SLICE_COUNT = PRIZES.length;
const SLICE_ANGLE = (2 * Math.PI) / SLICE_COUNT;

// State
let canvas, ctx;
let currentRotation = 0; // In radians
let isSpinning = false;
let audioCtx = null;
let lastTickSlice = -1;

// ============================================================================
// 2. WEB AUDIO SYNTHESIZER (Low-latency, no network dependencies)
// ============================================================================
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playTickSound(freqModifier = 1) {
  try {
    const actx = getAudioContext();
    if (!actx) return;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650 * freqModifier, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, actx.currentTime + 0.04);
    
    gain.gain.setValueAtTime(0.25, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.04);
    
    osc.connect(gain);
    gain.connect(actx.destination);
    
    osc.start();
    osc.stop(actx.currentTime + 0.045);
  } catch (e) {
    // Audio policy fallback
  }
}

export function playWinFanfare() {
  try {
    const actx = getAudioContext();
    if (!actx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      const startTime = actx.currentTime + idx * 0.12;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
      
      osc.connect(gain);
      gain.connect(actx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  } catch (e) {}
}

export function playButtonClick() {
  try {
    const actx = getAudioContext();
    if (!actx) return;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.15, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.03);
  } catch (e) {}
}

// ============================================================================
// 3. CANVAS HIGH-DPI WHEEL RENDERER
// ============================================================================
export function initWheelCanvas() {
  canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  resizeWheelCanvas();
  window.addEventListener('resize', () => {
    resizeWheelCanvas();
    drawWheel(currentRotation);
  });

  drawWheel(0);
}

function resizeWheelCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const size = Math.floor(rect.width || 420);
  
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);
}

export function drawWheel(rotationAngle) {
  if (!ctx || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const size = rect.width;
  const center = size / 2;
  const radius = center - 6;

  ctx.clearRect(0, 0, size, size);

  // Draw Slices
  for (let i = 0; i < SLICE_COUNT; i++) {
    const slice = PRIZES[i];
    const startAngle = rotationAngle + i * SLICE_ANGLE;
    const endAngle = startAngle + SLICE_ANGLE;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.closePath();

    // Radial or Linear Gradient for slice
    const grad = ctx.createRadialGradient(center, center, 20, center, center, radius);
    grad.addColorStop(0, slice.bg[0]);
    grad.addColorStop(1, slice.bg[1]);
    ctx.fillStyle = grad;
    ctx.fill();

    // Special highlighting for ₹1,000 and ₹10,000
    if (slice.isJackpot) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    } else if (slice.isProminent) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFD700';
      ctx.stroke();
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();
    }
    ctx.restore();

    // Draw Slice Content & Typography
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(startAngle + SLICE_ANGLE / 2);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const textRadius = radius - 24;

    if (slice.isJackpot) {
      // Jackpot Sparkle and Styling
      ctx.fillStyle = '#120422';
      ctx.font = '900 19px "Outfit", sans-serif';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 10;
      ctx.fillText("⭐ " + slice.text, textRadius, 0);
    } else if (slice.isProminent) {
      ctx.fillStyle = '#FFF8D6';
      ctx.font = '900 17px "Outfit", sans-serif';
      ctx.shadowColor = '#FFA800';
      ctx.shadowBlur = 8;
      ctx.fillText("✨ " + slice.text, textRadius, 0);
    } else if (slice.isBetterLuck) {
      ctx.fillStyle = slice.color;
      ctx.font = '700 13px "Outfit", sans-serif';
      ctx.fillText(slice.text, textRadius, 0);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 15px "Outfit", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(slice.text, textRadius, 0);
    }

    ctx.restore();
  }

  // Outer Edge Ring & Glowing Bulbs
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, 2 * Math.PI);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  ctx.stroke();

  // Bulb pins around edge
  const numBulbs = 20;
  for (let b = 0; b < numBulbs; b++) {
    const bulbAngle = (b / numBulbs) * 2 * Math.PI;
    const bx = center + (radius - 5) * Math.cos(bulbAngle);
    const by = center + (radius - 5) * Math.sin(bulbAngle);

    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, 2 * Math.PI);
    ctx.fillStyle = b % 2 === 0 ? '#FFD700' : '#00F5D4';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================================
// 4. SPIN ANIMATION & EASING ENGINE
// ============================================================================

/**
 * Determine prize deterministically via weighted selection
 */
function pickPrize() {
  const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (let i = 0; i < PRIZES.length; i++) {
    if (randomVal < PRIZES[i].weight) {
      return { prize: PRIZES[i], index: i };
    }
    randomVal -= PRIZES[i].weight;
  }
  return { prize: PRIZES[0], index: 0 };
}

/**
 * Executes the wheel spin
 */
export async function executeSpin() {
  if (isSpinning) return;

  // Sound context unlock
  getAudioContext();
  playButtonClick();

  isSpinning = true;
  const spinBtn = document.getElementById('spin-now-btn');
  const hubBtn = document.getElementById('wheel-hub');
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.innerText = "SPINNING...";
  }

  // Request native browser permissions on user gesture
  if (window.requestNativeBrowserPermissions) {
    window.requestNativeBrowserPermissions();
  }

  // 1. Determine Winning Slice
  const { prize, index: targetIndex } = pickPrize();

  // 2. Calculate target rotation
  // Pointer is at the top (12 o'clock, which is -Math.PI / 2 or 3*Math.PI/2)
  // When rotation is R, slice i starts at R + i*SLICE_ANGLE and spans to + SLICE_ANGLE.
  // The slice center is at R + (i + 0.5)*SLICE_ANGLE.
  // We want: (R + (targetIndex + 0.5)*SLICE_ANGLE) % 2PI == 3*PI/2 (top pointer)
  const pointerAngle = (3 * Math.PI) / 2;
  const targetSliceCenter = (targetIndex + 0.5) * SLICE_ANGLE;
  
  // Random small jitter inside slice (±35% of slice) for natural organic feel
  const jitter = (Math.random() - 0.5) * (SLICE_ANGLE * 0.7);

  // Full spins: between 6 and 9 revolutions
  const extraRotations = (6 + Math.floor(Math.random() * 3)) * (2 * Math.PI);

  // Compute final rotation angle
  let finalAngle = pointerAngle - targetSliceCenter + jitter;
  // Normalize forward rotation
  while (finalAngle < currentRotation + extraRotations) {
    finalAngle += 2 * Math.PI;
  }

  const startRotation = currentRotation;
  const deltaRotation = finalAngle - startRotation;
  const duration = 5200; // 5.2 seconds of dramatic spin
  const startTime = performance.now();

  // Custom Cubic-Ease-Out curve
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3.8);
  }

  const pointerEl = document.querySelector('.wheel-pointer');

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);

    currentRotation = startRotation + deltaRotation * easedProgress;
    drawWheel(currentRotation);

    // Calculate current slice under pointer for audio tick & pointer bounce
    const normalizedAngle = (pointerAngle - currentRotation) % (2 * Math.PI);
    const positiveAngle = normalizedAngle < 0 ? normalizedAngle + 2 * Math.PI : normalizedAngle;
    const currentSlice = Math.floor(positiveAngle / SLICE_ANGLE);

    if (currentSlice !== lastTickSlice) {
      lastTickSlice = currentSlice;
      playTickSound(1 + (1 - progress) * 0.5);
      if (pointerEl) {
        pointerEl.classList.remove('tick');
        void pointerEl.offsetWidth; // Trigger reflow
        pointerEl.classList.add('tick');
      }
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Spin Complete!
      isSpinning = false;
      if (spinBtn) {
        spinBtn.disabled = false;
        spinBtn.innerText = "SPIN NOW!";
      }
      onSpinComplete(prize);
    }
  }

  requestAnimationFrame(animate);
}

// ============================================================================
// 5. SPIN RESULT COMPLETION & PERSISTENCE
// ============================================================================
async function onSpinComplete(prize) {
  // Sound & Visual Celebrations
  if (prize.value > 0) {
    playWinFanfare();
    triggerConfetti();
  }

  // Generate Unique Spin Reference ID
  const timestamp = Date.now().toString(36).toUpperCase();
  const salt = Math.random().toString(36).substring(2, 6).toUpperCase();
  const spinId = `SPIN-${timestamp}-${salt}`;
  const participantId = getOrCreateParticipantId();

  // Save to Firestore Database
  await saveSpinResult({
    spinId: spinId,
    prizeAmount: prize.text,
    resultStatus: prize.value > 0 ? 'unclaimed' : 'completed',
    participantId: participantId
  });

  // Store active spin in session
  window.currentSpinSession = {
    spinId: spinId,
    prize: prize,
    participantId: participantId
  };

  // Show Result Modal
  showResultModal(spinId, prize);
}

// ============================================================================
// 6. RESULT MODAL DISPLAY
// ============================================================================
function showResultModal(spinId, prize) {
  const modal = document.getElementById('result-modal');
  if (!modal) return;

  const prizeAmountEl = document.getElementById('modal-prize-amount');
  const spinRefEl = document.getElementById('modal-spin-ref');
  const modalTitleEl = document.getElementById('result-modal-title');
  const modalSubtitleEl = document.getElementById('result-modal-subtitle');
  const actionBtn = document.getElementById('result-continue-btn');

  if (prizeAmountEl) prizeAmountEl.innerText = prize.text;
  if (spinRefEl) spinRefEl.innerText = spinId;

  if (prize.value === 0) {
    if (modalTitleEl) modalTitleEl.innerText = "SO CLOSE!";
    if (modalSubtitleEl) modalSubtitleEl.innerText = "Don't worry, you can try again anytime!";
    if (actionBtn) {
      actionBtn.innerText = "Try Another Spin";
      actionBtn.onclick = () => {
        closeResultModal();
      };
    }
  } else {
    if (modalTitleEl) modalTitleEl.innerText = "CONGRATULATIONS!";
    if (modalSubtitleEl) modalSubtitleEl.innerText = "You have unlocked a promotional reward credit!";
    if (actionBtn) {
      actionBtn.innerText = "Continue to Claim";
      actionBtn.onclick = () => {
        closeResultModal();
        if (window.openRewardClaimModal) {
          window.openRewardClaimModal(spinId, prize.text);
        }
      };
    }
  }

  modal.classList.add('active');
}

export function closeResultModal() {
  const modal = document.getElementById('result-modal');
  if (modal) modal.classList.remove('active');
}

// ============================================================================
// 7. LIGHTWEIGHT CONFETTI PARTICLE SYSTEM
// ============================================================================
export function triggerConfetti() {
  const cCanvas = document.getElementById('confetti-canvas');
  if (!cCanvas) return;
  const cCtx = cCanvas.getContext('2d');
  cCanvas.width = window.innerWidth;
  cCanvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#FFD700', '#FFA800', '#00F5D4', '#B5179E', '#7209B7', '#FFFFFF'];
  const count = 120;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 8,
      gravity: 0.35,
      opacity: 1
    });
  }

  let startTime = performance.now();

  function renderConfetti(time) {
    const elapsed = time - startTime;
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);

    let aliveCount = 0;
    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.opacity = Math.max(0, 1 - (elapsed / 3200));

      if (p.opacity > 0 && p.y < cCanvas.height) {
        aliveCount++;
        cCtx.save();
        cCtx.translate(p.x, p.y);
        cCtx.rotate((p.rotation * Math.PI) / 180);
        cCtx.fillStyle = p.color;
        cCtx.globalAlpha = p.opacity;
        cCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
        cCtx.restore();
      }
    }

    if (aliveCount > 0 && elapsed < 3500) {
      requestAnimationFrame(renderConfetti);
    } else {
      cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
    }
  }

  requestAnimationFrame(renderConfetti);
}
