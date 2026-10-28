/*
 * Керування презентацією:
 *   ↓ — наступний крок (коли слайд заповнено, він відлітає вгору і з'являється наступний);
 *   ↑ — крок назад;
 *   F — повний екран.
 * Позиція зберігається в адресі (#слайд.крок), тож після перезавантаження сторінки показ продовжується з того самого місця.
 * Слайд отримує події enter, leave і step; на них підписано ефекти у fx.js.
 */
(() => {
  const deck = document.getElementById('deck');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const progress = document.getElementById('progress');
  const counter = document.getElementById('counter');
  let index = 0;
  let step = 0;

  function fit() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    deck.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  const emit = (slide, type, detail = {}) => slide.dispatchEvent(new CustomEvent(type, { detail }));

  const maxStep = (slide) => Math.max(0, ...Array.from(slide.querySelectorAll('[data-step]'), (el) => +el.dataset.step));

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

  function update() {
    progress.style.width = `${index / (slides.length - 1) * 100}%`;
    counter.textContent = index ? `${index + 1} / ${slides.length}` : '';
    history.replaceState(null, '', `#${index + 1}.${step}`);
  }

  // Слайд, на який переходимо, отримує свій стан миттєво, щоб не мерехтіли кроки, показані раніше.
  function setInstantly(slide, k) {
    slide.classList.add('no-trans');
    applyStep(slide, k, false);
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); prev(); }
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
