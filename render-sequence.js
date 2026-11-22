/* Render wheel: on laptops the project's renders sit on a ring around a large
   main view; on phones they form a vertical reel. Scrolling turns the wheel:
   down brings the next render (right / below) into the main view, up goes back.
   The motion eases towards the scroll position, so mouse-wheel steps glide
   instead of jumping. Each main view casts its ambient glow.
   Scrolling stays native (wheel, trackpad, touch and keyboard all work). */
(() => {
 const sections = [...document.querySelectorAll('.render-sequence')];
 if (!sections.length) return;
 const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
 const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
 const ease = t => t * t * (3 - 2 * t);
 const lerp = (a, b, t) => a + (b - a) * t;
 const SMOOTH_MS = 110; // time constant of the glide

 sections.forEach(section => {
  const stage = section.querySelector('.rs-stage');
  const frames = [...section.querySelectorAll('.rs-frame')];
  const n = frames.length;
  if (!n) return;
  section.style.setProperty('--frames', n);
  section.classList.add('is-active');
  if (n === 1) section.classList.add('is-single');

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
  let geo = null, cur = null, target = 0, running = false, last = 0;

  const measure = () => {
   const W = stage.clientWidth, H = stage.clientHeight, mobile = W <= 700;
   geo = mobile ? {
    W, H, mobile,
    heroW: W * 0.94, heroH: H * 0.34,
    heroX: W / 2, heroY: H * 0.28,
    reelGap: H * 0.3,
    step: 0.7 * window.innerHeight
   } : {
    W, H, mobile,
    heroW: Math.min(W * 0.62, H * 1.25), heroH: H * 0.7,
    heroX: W / 2, heroY: H * 0.45,
    cx: W / 2, cy: H * 0.55,
    rx: W * 0.37, ry: H * 0.33,
    side: 0.42,  // renders either side of the main one
    thumb: 0.24, // renders at the bottom of the wheel
    step: 0.9 * window.innerHeight
   };
   frames.forEach(f => { f.style.width = geo.heroW + 'px'; f.style.height = geo.heroH + 'px'; });
  };

  // Scroll position -> wheel position (0 = first render in the main view).
  const readTarget = () => {
   const travelled = -section.getBoundingClientRect().top;
   section.classList.toggle('is-scrolled', travelled > 20);
   if (n < 2) return 0;
   const raw = clamp(travelled / geo.step, 0, n - 1);
   const k = Math.min(Math.floor(raw), n - 2);
   // Rest on each render, then turn to the next one.
   return k + ease(clamp((raw - k - 0.15) / 0.7, 0, 1));
  };

  const render = p => {
   const slot = (Math.PI * 2) / Math.max(n, 2);
   frames.forEach((f, i) => {
    let near, x, y, s, o, depth;
    if (geo.mobile) {
     // Vertical reel: renders stacked down the screen, the top one is main.
     const d = i - p; // <0 above (leaving), >0 below (coming up)
     near = ease(clamp(1 - Math.abs(d), 0, 1));
     x = geo.heroX;
     y = geo.heroY + d * geo.reelGap;
     s = d >= 0 ? lerp(0.82, 1, near) : lerp(0.75, 1, near);
     o = d >= 0 ? lerp(0.7, 1, near) : clamp(1 + d * 1.4, 0, 1);
     o *= clamp((geo.H * 0.82 - y) / (geo.H * 0.14), 0, 1); // clear of the caption
     depth = Math.abs(d) * 3;
    } else {
     // Ring: angle from the main position, wrapped to [-PI, PI].
     let a = (i - p) * slot;
     a = Math.atan2(Math.sin(a), Math.cos(a));
     near = ease(clamp(1 - Math.abs(a) / slot, 0, 1)); // 1 = main view
     const back = n > 2 ? clamp((Math.abs(a) - slot) / (Math.PI - slot), 0, 1) : 0;
     x = lerp(geo.cx + geo.rx * Math.sin(a), geo.heroX, near);
     y = lerp(geo.cy - geo.ry * Math.cos(a), geo.heroY, near);
     s = lerp(lerp(geo.side, geo.thumb, back), 1, near);
     o = lerp(lerp(0.9, 0.6, back), 1, near);
     depth = Math.abs(a) * 4;
    }
    f.style.transform = `translate3d(${(x - geo.heroW / 2).toFixed(2)}px, ${(y - geo.heroH / 2).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    f.style.zIndex = String(20 + Math.round(near * 40) - Math.round(depth));
    f.style.opacity = o.toFixed(3);
    f.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    f.classList.toggle('is-main', near > 0.5);
    f.setAttribute('aria-hidden', near > 0.5 ? 'false' : 'true');
    if (glows[i]) { glows[i].style.opacity = near.toFixed(3); glows[i].style.visibility = near < 0.01 ? 'hidden' : 'visible'; }
    if (caps[i]) caps[i].style.opacity = clamp(near * 2 - 1, 0, 1).toFixed(3);
   });
   if (count) count.textContent = String(Math.round(p) + 1).padStart(2, '0');
   if (bar) bar.style.transform = `scaleX(${n > 1 ? p / (n - 1) : 1})`;
  };

  const tick = now => {
   const dt = Math.min(64, now - (last || now));
   last = now;
   const k = reduce.matches ? 1 : 1 - Math.exp(-dt / SMOOTH_MS);
   cur = cur === null ? target : cur + (target - cur) * k;
   if (Math.abs(target - cur) < 0.0008) cur = target;
   render(cur);
   if (cur !== target) requestAnimationFrame(tick);
   else { running = false; last = 0; }
  };
  const wake = () => {
   target = readTarget();
   if (!running) { running = true; requestAnimationFrame(tick); }
  };
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => { measure(); render(cur ?? 0); wake(); });

  // Click a render on the ring to turn the wheel to it.
  frames.forEach((f, i) => f.addEventListener('click', () => {
   if (f.classList.contains('is-main') || !geo) return;
   const top = section.getBoundingClientRect().top + window.scrollY;
   window.scrollTo({ top: top + i * geo.step, behavior: reduce.matches ? 'instant' : 'smooth' });
  }));

  if (skip) skip.addEventListener('click', e => {
   const t = document.querySelector(skip.getAttribute('href'));
   if (!t) return;
   e.preventDefault();
   // Jump straight past the wheel instead of turning through every render.
   window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
   if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
   t.focus({ preventScroll: true });
  });

  measure();
  target = readTarget();
  cur = target;
  render(cur);
 });
})();
