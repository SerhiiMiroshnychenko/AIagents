/*
 * Керування презентацією:
 *   ↓ — наступний крок (коли слайд заповнено, він відлітає вгору і з'являється наступний);
 *   ↑ — крок назад;
 *   ← → — анімації та ефекти слайда: графіки, порівняння, підсвічування;
 *   F — повний екран.
 * Позиція зберігається в адресі (#слайд.крок), тож після перезавантаження сторінки показ продовжується з того самого місця.
 * Слайд отримує події enter, leave, step і fx; на них підписано ефекти у fx.js.
 */
(() => {
  const deck = document.getElementById('deck');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const progress = document.getElementById('progress');
  const counter = document.getElementById('counter');
  const dots = document.getElementById('fxdots');
  let index = 0;
  let step = 0;
  let fx = 0;

  function fit() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    deck.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  const emit = (slide, type, detail = {}) => slide.dispatchEvent(new CustomEvent(type, { detail }));

  const maxStep = (slide) => Math.max(0, ...Array.from(slide.querySelectorAll('[data-step]'), (el) => +el.dataset.step));

  // Скільки положень мають стрілки ← →: власні ефекти слайда (data-fx) або підсвічування [data-hl].
  const maxFx = (slide) => Math.max(+(slide.dataset.fx || 0), ...Array.from(slide.querySelectorAll('[data-hl]'), (el) => +el.dataset.hl));

  // Числа з data-count «набігають» від data-from до свого значення, коли їхній крок з'являється.
  document.querySelectorAll('[data-count]').forEach((el) => { el.dataset.final = el.textContent; });
  function countUp(root, animate) {
    root.querySelectorAll('[data-count]').forEach((el) => {
      cancelAnimationFrame(el.raf);
      if (!animate) { el.textContent = el.dataset.final; return; }
      const from = +(el.dataset.from || 0);
      const to = +el.dataset.count;
      const dec = +(el.dataset.dec || 0);
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.max(0, Math.min(1, (t - t0) / 1200));
        el.textContent = (from + (to - from) * (1 - (1 - p) ** 3)).toFixed(dec).replace('.', ',');
        if (p < 1) el.raf = requestAnimationFrame(tick);
        else el.textContent = el.dataset.final;
      };
      el.raf = requestAnimationFrame(tick);
    });
  }

  function applyStep(slide, k, animate) {
    slide.querySelectorAll('[data-step]').forEach((el) => {
      const on = +el.dataset.step <= k;
      if (on && !el.classList.contains('shown')) countUp(el, animate);
      el.classList.toggle('shown', on);
    });
    emit(slide, 'step', { step: k, instant: !animate });
  }

  function applyFx(slide, v) {
    const highlighted = Array.from(slide.querySelectorAll('[data-hl]'));
    highlighted.forEach((el) => el.classList.toggle('hl', +el.dataset.hl === v));
    slide.classList.toggle('hl-active', highlighted.some((el) => +el.dataset.hl === v));
    slide.dataset.fxs = v;
    emit(slide, 'fx', { fx: v });
  }

  // Крапки ← → з'являються лише на останньому кроці слайда (або поки ефект увімкнено)
  // і, щойно з'явившись, блимають, щоб доповідач їх не пропустив.
  function showDots() {
    const slide = slides[index];
    const max = maxFx(slide);
    if (!max || (step < maxStep(slide) && !fx)) {
      dots.innerHTML = '';
      return;
    }
    if (dots.children.length !== max + 1 || dots.dataset.slide !== String(index)) {
      dots.dataset.slide = index;
      dots.innerHTML = '<i class="blink"></i>'.repeat(max + 1);
    }
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('on', i === fx));
  }

  function update() {
    progress.style.width = `${index / (slides.length - 1) * 100}%`;
    counter.textContent = index ? `${index + 1} / ${slides.length}` : '';
    history.replaceState(null, '', `#${index + 1}.${step}`);
    showDots();
  }

  // Слайд, на який переходимо, отримує свій стан миттєво, щоб не мерехтіли кроки, показані раніше.
  function setInstantly(slide, k) {
    slide.classList.add('no-trans');
    applyStep(slide, k, false);
    applyFx(slide, 0);
    void slide.offsetWidth;
    slide.classList.remove('no-trans');
  }

  function go(newIndex, newStep, instant = false) {
    newIndex = Math.max(0, Math.min(slides.length - 1, newIndex));
    const slide = slides[newIndex];
    const k = Math.max(0, Math.min(maxStep(slide), newStep));
    if (newIndex !== index || instant) {
      const jump = instant || Math.abs(newIndex - index) > 1;
      if (jump) deck.classList.add('instant');
      if (newIndex !== index) emit(slides[index], 'leave');
      emit(slide, 'enter');
      setInstantly(slide, k);
      slides.forEach((s, i) => {
        s.classList.toggle('past', i < newIndex);
        s.classList.toggle('current', i === newIndex);
        s.classList.toggle('future', i > newIndex);
      });
      if (jump) {
        void deck.offsetWidth;
        deck.classList.remove('instant');
      }
    } else {
      applyStep(slide, k, true);
    }
    index = newIndex;
    step = k;
    fx = 0;
    update();
  }

  function next() {
    const slide = slides[index];
    if (step < maxStep(slide)) {
      step += 1;
      applyStep(slide, step, true);
      update();
    } else if (index < slides.length - 1) {
      go(index + 1, 0);
    }
  }

  function prev() {
    const slide = slides[index];
    if (step > 0) {
      step -= 1;
      applyStep(slide, step, true);
      update();
    } else if (index > 0) {
      go(index - 1, Infinity);
    }
  }

  function shiftFx(delta) {
    const slide = slides[index];
    const max = maxFx(slide);
    if (!max) return;
    fx = Math.max(0, Math.min(max, fx + delta));
    applyFx(slide, fx);
    showDots();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); shiftFx(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); shiftFx(-1); }
    else if (e.code === 'KeyF') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });

  window.addEventListener('resize', fit);

  function goToHash() {
    const [slideNo, stepNo] = (location.hash.slice(1) || '1.0').split('.').map(Number);
    go((slideNo || 1) - 1, stepNo || 0, true);
  }
  window.addEventListener('hashchange', goToHash);

  fit();
  goToHash();
})();
