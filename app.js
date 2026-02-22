(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  let state = {
    slides: [],
    currentIndex: 0,
    io: null,
    content: null,
  };

  function setTopOffset() {
    const nav = qs('#topnav');
    const root = document.documentElement;
    if (!nav || !root) return;
    const h = Math.ceil(nav.getBoundingClientRect().height);
    root.style.setProperty('--topOffset', h + 'px');
  }

  function updateCompactMode() {
    const h = window.innerHeight;
    const body = document.body;
    if (!body) return;
    if (h < 640) body.classList.add('vh-compact');
    else body.classList.remove('vh-compact');
  }

  function applyTheme(theme) {
    const body = document.body;
    if (!body) return;
    body.classList.remove('theme-green', 'theme-blue', 'theme-purple');
    const t = (theme || '').toLowerCase();
    body.classList.add('theme-' + (t || 'green'));
  }

  function el(tag, cls, attrs = {}) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    return node;
  }

  function addAnimOrder(node, order) {
    if (!node) return order;
    node.setAttribute('data-animate', '');
    node.style.setProperty('--order', order);
    return order + 1;
  }

  function buildSlide(slideData, index) {
    const slide = el('article', 'slide type-' + slideData.type, {
      role: 'group',
      'aria-roledescription': 'slide',
      'data-index': index
    });
    // inner wrapper to control stage padding
    const inner = el('div', 'slide-inner');

    // decorative browser chrome frame
    const card = el('div', 'slide-card');
    const chrome = el('div', 'chrome');
    chrome.append(
      el('span', 'c-dot c-red'),
      el('span', 'c-dot c-yellow'),
      el('span', 'c-dot c-green')
    );

    const content = el('div', 'slide-content');

    let order = 0;

    if (slideData.headline) {
      const h = el(slideData.type === 'title' ? 'h1' : 'h2', 'headline grad');
      h.textContent = slideData.headline;
      order = addAnimOrder(h, order);
      content.appendChild(h);
    }

    if (slideData.subheadline) {
      const sh = el('p', 'subheadline');
      sh.textContent = slideData.subheadline;
      order = addAnimOrder(sh, order);
      content.appendChild(sh);
    }

    if (Array.isArray(slideData.bullets) && slideData.bullets.length) {
      const list = el('ul', 'bullets');
      slideData.bullets.forEach((b) => {
        const li = el('li', 'bullet');
        const icon = el('span', 'bicon', { 'aria-hidden': 'true' });
        icon.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-opacity="0.18"/><path d="M5.5 10.2l3 3.2 6-6.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const txt = el('span', 'btext');
        txt.textContent = b;
        li.append(icon, txt);
        order = addAnimOrder(li, order);
        list.appendChild(li);
      });
      content.appendChild(list);
    }

    if (slideData.left || slideData.right) {
      const cols = el('div', 'cols');
      ['left', 'right'].forEach(side => {
        const cfg = slideData[side];
        if (!cfg) return;
        const col = el('div', 'col');
        if (cfg.title) {
          const ct = el('h3', 'col-title');
          ct.textContent = cfg.title;
          order = addAnimOrder(ct, order);
          col.appendChild(ct);
        }
        if (Array.isArray(cfg.bullets)) {
          const cl = el('ul', 'bullets tight');
          cfg.bullets.forEach(b => {
            const li = el('li', 'bullet');
            const dot = el('span', 'bicon small', { 'aria-hidden': 'true' });
            dot.innerHTML = '<svg viewBox="0 0 8 8" width="10" height="10" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>';
            const txt = el('span', 'btext');
            txt.textContent = b;
            li.append(dot, txt);
            order = addAnimOrder(li, order);
            cl.appendChild(li);
          });
          col.appendChild(cl);
        }
        cols.appendChild(col);
      });
      content.appendChild(cols);
    }

    if (slideData.note) {
      const note = el('p', 'speaker-note');
      note.textContent = slideData.note;
      order = addAnimOrder(note, order);
      content.appendChild(note);
    }

    // emphasize title and closing slides
    if (slideData.type === 'title') {
      slide.classList.add('emphasis');
    }
    if (slideData.type === 'closing') {
      slide.classList.add('closing');
    }

    card.append(chrome, content);
    inner.appendChild(card);
    slide.appendChild(inner);
    return slide;
  }

  function buildDeck(data) {
    const wrap = qs('#slides');
    const titleEl = qs('#deckTitle');
    if (!wrap || !data) return;
    wrap.innerHTML = '';

    state.slides = data.slides.map((s, i) => buildSlide(s, i));
    state.slides.forEach(sl => {
      // ensure scroll margin accounts for navbar height
      sl.style.scrollMarginTop = 'var(--topOffset)';
      wrap.appendChild(sl);
    });

    if (titleEl) titleEl.textContent = data.meta?.title || '';
    applyTheme(data.meta?.theme);
    document.title = (data.meta?.title || 'Deck') + (data.meta?.deckId ? ' — ' + data.meta.deckId : '');

    setupObserver();
    setTimeout(() => jumpTo(0, { instant: true }), 0);
  }

  function setupObserver() {
    const container = qs('#slidesWrap');
    if (!container) return;
    if (state.io) state.io.disconnect();
    state.io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = parseInt(entry.target.getAttribute('data-index') || '0', 10);
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          entry.target.classList.add('is-active');
          state.currentIndex = idx;
          updateProgress();
        } else if (entry.intersectionRatio < 0.2) {
          entry.target.classList.remove('is-active');
        }
      });
    }, { root: container, threshold: [0, 0.2, 0.6, 1] });

    state.slides.forEach(sl => state.io.observe(sl));
  }

  function updateProgress() {
    const bar = qs('#progressBar');
    if (!bar) return;
    const total = state.slides.length || 1;
    const pct = Math.round(((state.currentIndex + 1) / total) * 100);
    bar.style.transform = 'scaleX(' + (pct / 100) + ')';
  }

  function currentIndexInView() {
    return state.currentIndex || 0;
  }

  function jumpTo(index, opts = {}) {
    const container = qs('#slidesWrap');
    const slides = state.slides;
    if (!container || !slides.length) return;
    const i = Math.max(0, Math.min(index, slides.length - 1));
    const behavior = opts.instant ? 'auto' : 'smooth';
    slides[i].scrollIntoView({ behavior, block: 'start' });
  }

  function next() { jumpTo(currentIndexInView() + 1); }
  function prev() { jumpTo(currentIndexInView() - 1); }

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) prev(); else next();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        jumpTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        jumpTo((state.slides.length || 1) - 1);
      }
    });
  }

  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureExportLibs() {
    if (!window.html2canvas) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
  }

  function cloneBackgroundForStage() {
    const stage = qs('#pdfStage');
    const bg = qs('.bg-layers');
    if (!stage || !bg) return;
    const cloned = bg.cloneNode(true);
    stage.appendChild(cloned);
  }

  function forceAllVisibleForExport() {
    // Mark all slides as active to reveal animations
    state.slides.forEach(sl => sl.classList.add('is-active'));
  }

  function makeStage() {
    let stage = qs('#pdfStage');
    if (stage) stage.remove();
    stage = el('div', '', { id: 'pdfStage' });
    document.body.appendChild(stage);
    cloneBackgroundForStage();
    return stage;
  }

  async function exportPdf() {
    const btn = qs('#exportPdfBtn');
    if (!btn) return;
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Exporting…';
    document.body.classList.add('exportingPdf');

    try {
      await ensureExportLibs();
    } catch (err) {
      alert('Failed to load export libraries. Please allow cdnjs.cloudflare.com or self-host html2canvas and jsPDF.');
      document.body.classList.remove('exportingPdf');
      btn.disabled = false; btn.textContent = original;
      return;
    }

    try {
      forceAllVisibleForExport();
      const stage = makeStage();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'px', format: [1920, 1080], orientation: 'landscape', compress: true });
      const scale = Math.max(2, window.devicePixelRatio || 1);

      for (let i = 0; i < state.slides.length; i++) {
        // Clear previous slide clone
        const oldClone = qsa('.clone-host', stage)[0];
        if (oldClone) oldClone.remove();

        // Host to maintain layout/padding for stage
        const host = el('div', 'clone-host');
        stage.appendChild(host);

        // Clone slide
        const slide = state.slides[i].cloneNode(true);
        slide.classList.add('is-active');
        host.appendChild(slide);

        // Allow layout settle
        await new Promise(r => setTimeout(r, 30));

        const canvas = await window.html2canvas(stage, {
          backgroundColor: null,
          scale,
          useCORS: true,
          imageTimeout: 15000,
          logging: false,
          windowWidth: 1920,
          windowHeight: 1080
        });
        const img = canvas.toDataURL('image/png');
        if (i === 0) {
          pdf.addImage(img, 'PNG', 0, 0, 1920, 1080, undefined, 'FAST');
        } else {
          pdf.addPage([1920, 1080], 'landscape');
          pdf.addImage(img, 'PNG', 0, 0, 1920, 1080, undefined, 'FAST');
        }
      }

      pdf.save('FlowPitch.pdf');
    } catch (e) {
      console.error(e);
      alert('Export failed. If the page is very large or animations are heavy, try again.');
    } finally {
      const stage = qs('#pdfStage');
      if (stage) stage.remove();
      document.body.classList.remove('exportingPdf');
      const btn2 = qs('#exportPdfBtn');
      if (btn2) { btn2.disabled = false; btn2.textContent = original; }
    }
  }

  function setupPdfExport() {
    const btn = qs('#exportPdfBtn');
    if (!btn) return;
    btn.addEventListener('click', exportPdf);
  }

  async function init() {
    setTopOffset();
    updateCompactMode();
    setupKeyboard();
    setupPdfExport();

    window.addEventListener('resize', () => {
      setTopOffset();
      updateCompactMode();
    }, { passive: true });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { setTopOffset(); updateCompactMode(); }, 50);
    });

    try {
      const res = await fetch('./content.json?ts=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      state.content = data;
      buildDeck(data);
    } catch (e) {
      console.error('Failed to load content.json', e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
