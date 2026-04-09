// ─── Entry point ──────────────────────────────────────────────────────────────
import { startAudio }  from './audio.js';
import { setupScene, animate } from './animate.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
document.getElementById('component-1').addEventListener('click', async () => {
  try { await startAudio(); }
  catch (e) { console.warn('Audio capture unavailable:', e); }

  setupScene();
  animate();

  // Fade out the button, reveal the tagline
  setTimeout(() => {
    const btn = document.getElementById('buttonDiv');
    btn.style.transition = 'opacity 0.8s ease';
    btn.style.opacity    = '0';
    setTimeout(() => {
      btn.style.display = 'none';
      document.getElementById('tagline').style.opacity = '1';
    }, 850);
  }, 600);
});
