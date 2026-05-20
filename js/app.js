/* ========================
   KAURY — app.js
   Scroll-driven canvas animation
   ======================== */

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 145;
const FRAME_SPEED = 2.0;
const PRELOAD_FIRST = 10;

// DOM refs
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');
const canvasWrap = document.getElementById('canvas-wrap');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scrollContainer = document.getElementById('scroll-container');
const heroSection = document.querySelector('.hero-standalone');

let frames = new Array(FRAME_COUNT);
let loadedCount = 0;
let currentFrame = 0;
let bgColor = '#0e0c0b';

// ========================
// CANVAS SETUP
// ========================
function resizeCanvas() {
  // Cap DPR at 2 — retina is fine, 3x is expensive on mobile
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
  drawFrame(currentFrame);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvas();
    positionSections();
    ScrollTrigger.refresh();
  }, 200);
});

// ========================
// BACKGROUND COLOR SAMPLER
// ========================
function sampleBgColor(img) {
  const offscreen = document.createElement('canvas');
  offscreen.width = 20;
  offscreen.height = 20;
  const oc = offscreen.getContext('2d');
  oc.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, 20, 20);
  const corners = [
    oc.getImageData(0, 0, 1, 1).data,
    oc.getImageData(19, 0, 1, 1).data,
    oc.getImageData(0, 19, 1, 1).data,
    oc.getImageData(19, 19, 1, 1).data,
  ];
  const avg = corners.reduce((acc, c) => [acc[0]+c[0], acc[1]+c[1], acc[2]+c[2]], [0,0,0]);
  const r = Math.round(avg[0]/4), g = Math.round(avg[1]/4), b = Math.round(avg[2]/4);
  return `rgb(${r},${g},${b})`;
}

// ========================
// FRAME RENDERER
// ========================
const IMAGE_SCALE = 0.88;

function drawFrame(index) {
  const img = frames[index];
  if (!img || !img.complete) return;

  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ========================
// FRAME PRELOADER
// ========================
function loadFrame(index) {
  return new Promise((resolve) => {
    const img = new Image();
    const num = String(index + 1).padStart(4, '0');
    img.src = `frames/frame_${num}.jpg`;
    img.onload = () => {
      frames[index] = img;
      loadedCount++;
      const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
      loaderBar.style.width = pct + '%';
      loaderPercent.textContent = pct + '%';
      if (index % 20 === 0) bgColor = sampleBgColor(img);
      resolve();
    };
    img.onerror = resolve;
  });
}

async function preloadFrames() {
  // Phase 1: first N frames
  const firstBatch = Array.from({ length: PRELOAD_FIRST }, (_, i) => loadFrame(i));
  await Promise.all(firstBatch);
  drawFrame(0);

  // Phase 2: remaining frames in background
  const remaining = Array.from({ length: FRAME_COUNT - PRELOAD_FIRST }, (_, i) => loadFrame(i + PRELOAD_FIRST));
  await Promise.all(remaining);

  // All loaded — hide loader
  gsap.to(loader, {
    opacity: 0,
    duration: 0.8,
    ease: 'power2.in',
    onComplete: () => { loader.style.display = 'none'; }
  });

  initSite();
}

// ========================
// LENIS SMOOTH SCROLL
// ========================
function initLenis() {
  const isMobile = window.innerWidth <= 768;
  const lenis = new Lenis({
    duration: isMobile ? 0.9 : 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: isMobile ? 2.0 : 1.0,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis; // caller stores and passes to initProgressBar / initSmoothNavLinks
}

// ========================
// HERO TRANSITION (circle-wipe, tied to hero scrolling away)
// ========================
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: heroSection,
    start: 'top top',    // hero top at viewport top
    end: 'bottom top',   // hero fully scrolled away
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress; // 0=hero visible, 1=hero gone
      // Fade the hero out
      heroSection.style.opacity = Math.max(0, 1 - p * 1.8);
      // Canvas expands via circle wipe — starts at 5%, fully open by end
      const wipeProgress = Math.min(1, Math.max(0, (p - 0.05) / 0.85));
      const radius = wipeProgress * 150; // 150% ensures full viewport cover
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    }
  });
}

// ========================
// FRAME SCROLL BINDING
// ========================
function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
      if (index !== currentFrame) {
        currentFrame = index;
        // Update bg color periodically
        if (index % 20 === 0 && frames[index]) bgColor = sampleBgColor(frames[index]);
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    }
  });
}

// ========================
// DARK OVERLAY
// ========================
function initDarkOverlay(enter, leave) {
  const overlay = document.getElementById('dark-overlay');
  const fadeRange = 0.04;
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= enter - fadeRange && p <= enter) {
        opacity = (p - (enter - fadeRange)) / fadeRange;
      } else if (p > enter && p < leave) {
        opacity = 0.92;
      } else if (p >= leave && p <= leave + fadeRange) {
        opacity = 0.92 * (1 - (p - leave) / fadeRange);
      }
      overlay.style.opacity = opacity;
    }
  });
}

// ========================
// MARQUEE
// ========================
function initMarquee(enter, leave) {
  const marqueeWrap = document.getElementById('marquee-1');
  const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -30;
  const fadeRange = 0.04;

  gsap.to(marqueeWrap.querySelector('.marquee-text'), {
    xPercent: speed,
    ease: 'none',
    scrollTrigger: {
      trigger: scrollContainer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    }
  });

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= enter - fadeRange && p <= enter) {
        opacity = (p - (enter - fadeRange)) / fadeRange;
      } else if (p > enter && p < leave) {
        opacity = 1;
      } else if (p >= leave && p <= leave + fadeRange) {
        opacity = 1 - (p - leave) / fadeRange;
      }
      marqueeWrap.style.opacity = opacity;
    }
  });
}

// ========================
// SECTION POSITIONS
// ========================
function positionSections() {
  const containerH = scrollContainer.getBoundingClientRect().height;
  const viewportH = window.innerHeight;
  // "bottom bottom" triggers across (containerH - viewportH) of scroll
  const effectiveRange = containerH - viewportH;

  document.querySelectorAll('.scroll-section').forEach((section) => {
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const mid = (enter + leave) / 2;
    // Position section so its center aligns with viewport center when progress=mid
    const top = mid * effectiveRange + viewportH / 2;
    section.style.top = top + 'px';
    section.style.transform = 'translateY(-50%)';
    section.style.height = viewportH + 'px';
  });
}

// ========================
// SECTION ANIMATIONS
// ========================
function setupSectionAnimation(section) {
  const type = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter = parseFloat(section.dataset.enter) / 100;
  const leave = parseFloat(section.dataset.leave) / 100;

  const children = section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .section-note, .cta-heading, .cta-sub, .cta-button, .stat'
  );

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case 'fade-up':
      tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-left':
      tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.from(children, { scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'rotate-in':
      tl.from(children, { y: 40, rotation: 2, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'power3.out' });
      break;
    case 'stagger-up':
      tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
      break;
    case 'clip-reveal':
      tl.from(children, {
        clipPath: 'inset(100% 0 0 0)', opacity: 0, stagger: 0.15, duration: 1.2, ease: 'power4.inOut'
      });
      break;
  }

  const fadeRange = 0.035;
  let hasPlayed = false;
  const isStats = section.classList.contains('section-stats');

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: false,
    onUpdate: (self) => {
      const p = self.progress;
      const inRange = p >= enter && p <= leave;

      if (inRange) {
        section.style.opacity = '1';
        section.classList.add('is-visible');
        if (!hasPlayed) {
          tl.play();
          if (isStats) playCounters();
          hasPlayed = true;
        }
      } else if (!persist) {
        section.style.opacity = '0';
        section.classList.remove('is-visible');
        if (p < enter) {
          tl.pause(0);
          hasPlayed = false;
        }
      }
    }
  });
}

// ========================
// COUNTER ANIMATIONS
// Called when stats section becomes visible
// ========================
function playCounters() {
  document.querySelectorAll('.stat-number').forEach((el) => {
    const target = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0');
    gsap.fromTo(el,
      { textContent: decimals === 0 ? 0 : 0.0 },
      {
        textContent: target,
        duration: 2.2,
        ease: 'power1.out',
        snap: { textContent: decimals === 0 ? 1 : Math.pow(10, -decimals) },
        onUpdate() { if (decimals > 0) el.textContent = parseFloat(el.textContent).toFixed(decimals); }
      }
    );
  });
}

// ========================
// CANVAS FADE-OUT (as user reaches shop/about section)
// ========================
function initCanvasFade() {
  const shopSection = document.getElementById('shop');
  const trigger = shopSection || document.getElementById('about');
  if (!trigger) return;
  ScrollTrigger.create({
    trigger,
    start: 'top 85%',
    end: 'top 20%',
    scrub: true,
    onUpdate: (self) => {
      canvasWrap.style.opacity = Math.max(0, 1 - self.progress * 1.4);
    }
  });
}

// ========================
// SCROLL PROGRESS BAR
// ========================
function initProgressBar(lenis) {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  lenis.on('scroll', () => {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${Math.min(scrollTop / docH, 1)})`;
  });
}

// ========================
// SMOOTH SCROLL NAV
// ========================
function initSmoothNavLinks(lenis) {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    });
  });
}

// ========================
// CHECKOUT MODAL
// ========================
const WHISH_NUMBER = '+96176723303';
const SHIPPING = 3.00;

let checkoutPrice = 0;
let checkoutQty = 1;
let checkoutRef = '';

function genRef() {
  return 'KRY-' + Date.now().toString(36).toUpperCase().slice(-6);
}

function updateTotals() {
  const sub = (checkoutPrice * checkoutQty).toFixed(2);
  const shipping = checkoutQty > 0 ? SHIPPING : 0;
  const total = (parseFloat(sub) + shipping).toFixed(2);
  const subEl = document.getElementById('checkout-subtotal');
  const totalEl = document.getElementById('checkout-total');
  if (subEl) subEl.textContent = '$' + sub;
  if (totalEl) totalEl.textContent = '$' + total;
  return total;
}

function openCheckout(btn) {
  const name  = btn.dataset.name  || 'KAURY Coffee';
  const price = parseFloat(btn.dataset.price) || 0;
  const image = btn.dataset.image || '';
  const desc  = btn.dataset.desc  || '';

  checkoutPrice = price;
  checkoutQty = 1;
  checkoutRef = genRef();

  // populate step 1
  const imgEl = document.getElementById('checkout-img');
  if (imgEl) { imgEl.src = image; imgEl.alt = name; }
  const nameEl = document.getElementById('checkout-name');
  if (nameEl) nameEl.textContent = name;
  const descEl = document.getElementById('checkout-desc');
  if (descEl) descEl.textContent = desc;
  const qtyEl = document.getElementById('qty-value');
  if (qtyEl) qtyEl.textContent = '1';
  const shipEl = document.getElementById('checkout-shipping');
  if (shipEl) shipEl.textContent = '$' + SHIPPING.toFixed(2);
  updateTotals();

  // show step 1, hide others
  showStep(1);

  // open overlay
  const overlay = document.getElementById('checkout-overlay');
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  // animate in
  gsap.from('.checkout-modal', { y: 30, opacity: 0, duration: 0.45, ease: 'power3.out' });
}

function closeCheckout() {
  const overlay = document.getElementById('checkout-overlay');
  gsap.to('.checkout-modal', {
    y: 20, opacity: 0, duration: 0.3, ease: 'power2.in',
    onComplete: () => {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      document.querySelector('.checkout-modal').style.opacity = '';
      document.querySelector('.checkout-modal').style.transform = '';
    }
  });
}

function showStep(n) {
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.toggle('checkout-step--hidden', i !== n);
  });
}

function initCheckoutModal() {
  const overlay = document.getElementById('checkout-overlay');
  const closeBtn = document.getElementById('checkout-close');
  const nextBtn  = document.getElementById('checkout-next');
  const backBtn  = document.getElementById('checkout-back');
  const confirmBtn = document.getElementById('checkout-confirm');
  const doneBtn  = document.getElementById('checkout-done');
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus  = document.getElementById('qty-plus');
  const copyBtn  = document.getElementById('whish-copy');

  if (!overlay) return;

  // Order buttons (footer + quick-order overlay)
  document.querySelectorAll('.order-now-btn, .quick-order-btn').forEach((btn) => {
    btn.addEventListener('click', () => openCheckout(btn));
  });

  // Close
  if (closeBtn) closeBtn.addEventListener('click', closeCheckout);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCheckout(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCheckout(); });

  // Qty
  if (qtyMinus) qtyMinus.addEventListener('click', () => {
    if (checkoutQty > 1) {
      checkoutQty--;
      document.getElementById('qty-value').textContent = checkoutQty;
      updateTotals();
    }
  });
  if (qtyPlus) qtyPlus.addEventListener('click', () => {
    checkoutQty++;
    document.getElementById('qty-value').textContent = checkoutQty;
    updateTotals();
  });

  // Step 1 → 2
  if (nextBtn) nextBtn.addEventListener('click', () => {
    const total = updateTotals();
    const nameEl = document.getElementById('checkout-name');
    const productName = nameEl ? nameEl.textContent : '';

    // populate step 2
    const phoneEl = document.getElementById('whish-phone');
    if (phoneEl) phoneEl.textContent = WHISH_NUMBER;
    const refEl = document.getElementById('whish-ref');
    if (refEl) refEl.textContent = checkoutRef;
    const amtEl = document.getElementById('whish-amount');
    if (amtEl) amtEl.textContent = '$' + total;
    const payName = document.getElementById('pay-product-name');
    if (payName) payName.textContent = productName;
    const payQty = document.getElementById('pay-product-qty');
    if (payQty) payQty.textContent = `Qty: ${checkoutQty}  ·  Total: $${total}`;

    showStep(2);
  });

  // Back
  if (backBtn) backBtn.addEventListener('click', () => showStep(1));

  // Confirm payment
  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    const refFinal = document.getElementById('confirm-ref');
    if (refFinal) refFinal.textContent = checkoutRef;
    showStep(3);
    gsap.from('#step-3 .checkout-success > *', {
      y: 20, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out'
    });
  });

  // Done
  if (doneBtn) doneBtn.addEventListener('click', () => {
    closeCheckout();
    showStep(1);
  });

  // Copy Whish number
  if (copyBtn) copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(WHISH_NUMBER).catch(() => {});
    copyBtn.style.color = '#D8003A';
    setTimeout(() => { copyBtn.style.color = ''; }, 1500);
  });
}

// ========================
// ABOUT SECTION ANIMATIONS
// ========================
function initAboutAnimations() {
  const about = document.getElementById('about');
  if (!about) return;

  gsap.from('.about-eyebrow', {
    y: 20, opacity: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: '.about-header', start: 'top 82%', toggleActions: 'play none none none' }
  });

  gsap.from('.about-heading', {
    y: 55, opacity: 0, duration: 1.1, ease: 'power3.out', delay: 0.1,
    scrollTrigger: { trigger: '.about-header', start: 'top 82%', toggleActions: 'play none none none' }
  });

  gsap.from('.about-line', {
    scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power3.out', delay: 0.3,
    scrollTrigger: { trigger: '.about-header', start: 'top 82%', toggleActions: 'play none none none' }
  });

  gsap.from('.about-story p', {
    y: 35, opacity: 0, stagger: 0.16, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '.about-story', start: 'top 78%', toggleActions: 'play none none none' }
  });

  gsap.from('.about-value', {
    y: 45, opacity: 0, stagger: 0.2, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: '.about-values', start: 'top 80%', toggleActions: 'play none none none' }
  });

  gsap.from('.about-cta-link', {
    x: -25, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: '.about-cta-row', start: 'top 90%', toggleActions: 'play none none none' }
  });
}

// ========================
// 3D CARD TILT ON MOUSE MOVE
// ========================
function initCardTilt() {
  document.querySelectorAll('.product-card').forEach((card) => {
    let rafId = null;

    card.addEventListener('mousemove', (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 → 0.5
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        const rotX = -y * 10;
        const rotY =  x * 10;
        const glowX = (x + 0.5) * 100;
        const glowY = (y + 0.5) * 100;
        card.style.transform =
          `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px) scale(1.01)`;
        // Subtle radial glow follows cursor on featured card
        if (card.classList.contains('product-card--featured')) {
          card.style.background =
            `radial-gradient(circle at ${glowX}% ${glowY}%, #1e1512 0%, #130f0e 60%)`;
        }
      });
    });

    card.addEventListener('mouseleave', () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1), background 0.6s';
      card.style.transform = '';
      if (card.classList.contains('product-card--featured')) {
        card.style.background = '#130f0e';
      }
      setTimeout(() => { card.style.transition = ''; }, 600);
    });
  });
}

// ========================
// PRODUCTS SECTION ANIMATIONS
// ========================
function initProductsAnimations() {
  const shop = document.getElementById('shop');
  if (!shop) return;

  // Header elements
  gsap.from('.products-eyebrow', {
    y: 18, opacity: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: '.products-header', start: 'top 84%', toggleActions: 'play none none none' }
  });
  gsap.from('.products-heading', {
    y: 45, opacity: 0, duration: 1.0, ease: 'power3.out', delay: 0.1,
    scrollTrigger: { trigger: '.products-header', start: 'top 84%', toggleActions: 'play none none none' }
  });
  gsap.from('.products-sub', {
    y: 22, opacity: 0, duration: 0.8, ease: 'power2.out', delay: 0.22,
    scrollTrigger: { trigger: '.products-header', start: 'top 84%', toggleActions: 'play none none none' }
  });

  // Cards: staggered reveal via CSS class toggled on scroll
  const cards = document.querySelectorAll('.product-card');
  if (!cards.length) return;

  ScrollTrigger.create({
    trigger: '.products-grid',
    start: 'top 82%',
    onEnter: () => {
      cards.forEach((card, i) => {
        setTimeout(() => {
          card.style.transition = `opacity 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 0.14}s, transform 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 0.14}s, box-shadow 0.3s, transform 0.3s`;
          card.classList.add('is-visible');
        }, i * 20);
      });
    },
    once: true
  });

  gsap.from('.products-note-text', {
    y: 18, opacity: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: '.products-note-text', start: 'top 92%', toggleActions: 'play none none none' }
  });
}

// ========================
// FOOTER ANIMATIONS
// ========================
function initFooterAnimations() {
  gsap.from('.footer-logo, .footer-tagline, .footer-contact', {
    y: 30, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: '.site-footer', start: 'top 88%', toggleActions: 'play none none none' }
  });

  gsap.from('.footer-col', {
    y: 30, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: '.footer-top', start: 'top 88%', toggleActions: 'play none none none' }
  });

  gsap.from('.footer-bottom', {
    y: 20, opacity: 0, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: '.footer-divider', start: 'top 95%', toggleActions: 'play none none none' }
  });
}

// ========================
// INIT SITE (after load)
// ========================
function initSite() {
  resizeCanvas();
  drawFrame(0);

  const lenis = initLenis();
  positionSections();
  initHeroTransition();
  initFrameScroll();

  initDarkOverlay(0.52, 0.68);
  initMarquee(0.24, 0.52);

  document.querySelectorAll('.scroll-section').forEach(setupSectionAnimation);

  initCanvasFade();
  initProgressBar(lenis);
  initSmoothNavLinks(lenis);
  initCheckoutModal();
  initCardTilt();
  initAboutAnimations();
  initProductsAnimations();
  initFooterAnimations();

  ScrollTrigger.refresh();
}

// ========================
// BOOT
// ========================
resizeCanvas(); // size canvas before any draw calls
preloadFrames();
