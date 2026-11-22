/* Scroll-driven render sequence: one render per screen of scrolling,
   crossfading into the next, then the page continues to the project text.
   Scrolling stays native (wheel, trackpad, touch and keyboard all work). */
(() => {
 const sections = [...document.querySelectorAll('.render-sequence')];
 if (!sections.length) return;
 const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
 const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
 const ease = t => t * t * (3 - 2 * t);

 sections.forEach(section => {
  const frames = [...section.querySelectorAll('.rs-frame')];
  const n = frames.length;
  if (!n) return;
  section.style.setProperty('--frames', n);
  section.classList.add('is-active');
  const count = section.querySelector('.rs-current');
  const bar = section.querySelector('.rs-progress span');
  const skip = section.querySelector('.rs-skip');
  let queued = false;

  if (skip) skip.addEventListener('click', e => {
   const target = document.querySelector(skip.getAttribute('href'));
   if (!target) return;
   e.preventDefault();
   // Jump straight past the sequence instead of animating through every render.
   window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
   if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
   target.focus({ preventScroll: true });
  });

  // A single render gets the full-screen glow but no scroll sequence.
  if (n === 1) { section.classList.add('is-single'); frames[0].style.setProperty('--cap', 1); return; }

  const update = () => {
   queued = false;
   const vh = window.innerHeight;
   const step = (window.innerWidth <= 700 ? 0.7 : 0.9) * vh;
   const travelled = -section.getBoundingClientRect().top;
   const p = clamp(travelled / step, 0, n - 1);
   const k = Math.min(Math.floor(p), n - 2);
   // Hold each render for the first quarter of its scroll, then fade slowly.
   const t = ease(clamp((p - k - 0.25) / 0.7, 0, 1));
   // The incoming render brightens over the outgoing one, which fades a little later,
   // so the screen never dims into a muddy double exposure.
   const tin = ease(clamp(t / 0.75, 0, 1));
   const tout = ease(clamp((t - 0.4) / 0.6, 0, 1));
   frames.forEach((f, i) => {
    let o = 0, cap = 0;
    if (i === k) { o = 1 - tout; cap = clamp(1 - t * 2, 0, 1); }
    else if (i === k + 1) { o = tin; cap = clamp(t * 2 - 1, 0, 1); }
    f.style.setProperty('--cap', cap);
    f.style.opacity = o;
    f.style.transform = (i === k + 1 && !reduce.matches) ? `scale(${1.035 - 0.035 * t})` : '';
    f.setAttribute('aria-hidden', (i === k ? t <= 0.5 : i === k + 1 && t > 0.5) ? 'false' : 'true');
   });
   const shown = t > 0.5 ? k + 2 : k + 1;
   if (count) count.textContent = String(shown).padStart(2, '0');
   if (bar) bar.style.width = (p / (n - 1) * 100) + '%';
   section.classList.toggle('is-scrolled', travelled > 20);
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();

 });
})();
