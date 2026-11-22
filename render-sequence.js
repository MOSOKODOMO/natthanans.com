/* Render wheel: the project's renders sit on a ring. Scrolling turns the wheel;
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
    heroH: mobile ? H * 0.4 : H * 0.52,
    heroX: W / 2, heroY: mobile ? H * 0.3 : H * 0.44,
    cx: W / 2, cy: mobile ? H * 0.58 : H * 0.5,
    rx: mobile ? W * 0.34 : W * 0.37,
    ry: mobile ? H * 0.27 : H * 0.36,
    thumb: mobile ? 0.3 : 0.32,
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
    // Angle from the top of the wheel, wrapped to [-PI, PI].
    let a = (i - p) * slot;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const near = ease(clamp(1 - Math.abs(a) / slot, 0, 1)); // 1 = main view
    const rx = geo.cx + geo.rx * Math.sin(a);
    const ry = geo.cy - geo.ry * Math.cos(a);
    const x = lerp(rx, geo.heroX, near);
    const y = lerp(ry, geo.heroY, near);
    const s = lerp(geo.thumb, 1, near);
    f.style.transform = `translate(${x - geo.heroW / 2}px, ${y - geo.heroH / 2}px) scale(${s})`;
    f.style.zIndex = String(10 + Math.round(near * 50) - Math.round(Math.abs(a) * 2));
    f.style.opacity = String(lerp(0.55, 1, near));
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
