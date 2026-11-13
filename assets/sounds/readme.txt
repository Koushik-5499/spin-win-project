SPIN & WIN - AUDIO ENGINE ARCHITECTURE
========================================

The project includes an active Web Audio API synthesizer integrated directly in `js/spin.js`:
- Real-time wheel slice ticks with dynamic pitch shifting as deceleration occurs
- Victory fanfare chords upon landing on a winning slice
- Tactile button clicks

Benefits of the Web Audio API engine:
- Zero external network latency (no dropped audio packets)
- Zero CORS audio restrictions
- Works seamlessly on mobile and desktop without requiring external audio asset hosting

If you wish to use external custom MP3 or WAV files instead, place them in this folder and reference them via standard HTML5 Audio objects.
