/* Render wheel: on laptops the project's renders sit on a ring (on phones,
   a vertical reel). Scrolling turns the wheel;
   the render arriving at the top grows into the large main view while the one
   leaving shrinks back into the ring. Each main view casts its ambient glow.
   Scrolling stays native (wheel, trackpad, touch and keyboard all work). */
(() => {
 const sections = [...document.querySelectorAll('.render-sequence')];
 if (!sections.length) return;
 const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
 const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
 const ease = t => t * t * (3 - 2 * t);
 const lerp = (a, b, t) => a + (b - a) * t;

 sections.forEach(section => {
  const stage = section.querySelector('.rs-stage');
  const frames = [...section.querySelectorAll('.rs-frame')];
  const n = frames.length;
  if (!n) return;
  section.style.setProperty('--frames', n);
  section.classList.add('is-active');

  // Glows and captions live on the stage, not inside the moving frames.
  const glowLayer = document.createElement('div');
  glowLayer.className = 'rs-glows';
  glowLayer.setAttribute('aria-hidden', 'true');
  const capLayer = document.createElement('div');
  capLayer.className = 'rs-captions';
  stage.prepend(glowLayer);
  stage.append(capLayer);
  const glows = frames.map(f => { const g = f.querySelector('.rs-glow'); if (g) glowLayer.append(g); return g; });
  const caps = frames.map(f => { const c = f.querySelector('figcaption'); if (c) capLayer.append(c); return c; });

  const count = section.querySelector('.rs-current');
  const bar = section.querySelector('.rs-progress span');
  const skip = section.querySelector('.rs-skip');
  let queued = false, geo = null;

  const measure = () => {
   const W = stage.clientWidth, H = stage.clientHeight, mobile = W <= 700;
   geo = {
    W, H, mobile,
    heroW: mobile ? W * 0.9 : Math.min(W * 0.54, H * 1.05),
    heroH: mobile ? H * 0.3 : H * 0.52,
    // Phones: a vertical reel instead of the ring.
    reelGap: H * 0.27,
    heroX: W / 2, heroY: mobile ? H * 0.27 : H * 0.42,
    cx: W / 2, cy: H * 0.55,
    rx: W * 0.36,
    ry: H * 0.34,
    side: 0.5,   // renders either side of the main one
    thumb: 0.27, // renders at the bottom of the wheel
    step: (mobile ? 0.7 : 0.9) * window.innerHeight
   };
   frames.forEach(f => { f.style.width = geo.heroW + 'px'; f.style.height = geo.heroH + 'px'; });
  };

  // p = wheel position in renders (0 = first render at the top).
  const position = () => {
   const travelled = -section.getBoundingClientRect().top;
   const raw = clamp(travelled / geo.step, 0, n - 1);
   const k = Math.min(Math.floor(raw), Math.max(n - 2, 0));
   // Rest on each render, then turn the wheel to the next one.
   return { p: n > 1 ? k + ease(clamp((raw - k - 0.2) / 0.6, 0, 1)) : 0, travelled };
  };

  const update = () => {
   queued = false;
   if (!geo) measure();
   const { p, travelled } = position();
   const slot = (Math.PI * 2) / Math.max(n, 2);
   frames.forEach((f, i) => {
    let near, x, y, s, o, depth;
    if (geo.mobile) {
     // Vertical reel: renders stacked down the screen, the top one is main.
     const d = i - p; // <0 above (leaving), >0 below (coming up)
     near = ease(clamp(1 - Math.abs(d), 0, 1));
     x = geo.heroX;
     y = geo.heroY + d * geo.reelGap + (d > 0 ? (1 - near) * geo.H * 0.03 : 0);
     s = d >= 0 ? lerp(0.8, 1, near) : lerp(0.7, 1, near);
     o = d >= 0 ? lerp(0.7, 1, near) : clamp(1 + d * 1.4, 0, 1);
     // Fade renders as they reach the caption at the bottom of the screen.
     o *= clamp((geo.H * 0.82 - y) / (geo.H * 0.14), 0, 1);
     depth = Math.abs(d) * 3;
    } else {
     // Ring: angle from the top of the wheel, wrapped to [-PI, PI].
     let a = (i - p) * slot;
     a = Math.atan2(Math.sin(a), Math.cos(a));
     near = ease(clamp(1 - Math.abs(a) / slot, 0, 1)); // 1 = main view
     // Neighbours flank the main render large; renders further round sit
     // smaller towards the bottom of the wheel.
     const back = n > 2 ? clamp((Math.abs(a) - slot) / (Math.PI - slot), 0, 1) : 0;
     const ringScale = lerp(geo.side, geo.thumb, back);
     x = lerp(geo.cx + geo.rx * Math.sin(a), geo.heroX, near);
     y = lerp(geo.cy - geo.ry * Math.cos(a), geo.heroY, near);
     s = lerp(ringScale, 1, near);
     o = lerp(lerp(0.9, 0.6, back), 1, near);
     depth = Math.abs(a) * 4;
    }
    f.style.transform = `translate(${x - geo.heroW / 2}px, ${y - geo.heroH / 2}px) scale(${s})`;
    f.style.zIndex = String(20 + Math.round(near * 40) - Math.round(depth));
    f.style.opacity = String(o);
    f.classList.toggle('is-main', near > 0.5);
    f.setAttribute('aria-hidden', near > 0.5 ? 'false' : 'true');
    if (glows[i]) glows[i].style.opacity = String(near);
    if (caps[i]) caps[i].style.opacity = String(clamp(near * 2 - 1, 0, 1));
   });
   const shown = Math.round(p) + 1;
   if (count) count.textContent = String(shown).padStart(2, '0');
   if (bar) bar.style.width = (n > 1 ? p / (n - 1) * 100 : 100) + '%';
   section.classList.toggle('is-scrolled', travelled > 20);
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { measure(); request(); });

  // Click a render on the ring to turn the wheel to it.
  frames.forEach((f, i) => f.addEventListener('click', () => {
   if (f.classList.contains('is-main') || !geo) return;
   const top = section.getBoundingClientRect().top + window.scrollY;
   window.scrollTo({ top: top + i * geo.step, behavior: reduce.matches ? 'instant' : 'smooth' });
  }));

  if (skip) skip.addEventListener('click', e => {
   const target = document.querySelector(skip.getAttribute('href'));
   if (!target) return;
   e.preventDefault();
   // Jump straight past the wheel instead of turning through every render.
   window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
   if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
   target.focus({ preventScroll: true });
  });

  if (n === 1) section.classList.add('is-single');
  measure();
  update();
 });
})();
