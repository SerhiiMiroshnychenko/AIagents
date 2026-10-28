/*
 * Анімації та ефекти слайдів. Зміст показують стрілки ↓ ↑ (app.js), а тут — те, що рухається:
 *   фонова «мережа» на першому й останньому слайдах;
 *   питання, що з'являється слово за словом;
 *   графіки, які малюються на кроці, й анімації, що грають самі, поки на слайді видно їхню картинку;
 *   крапка, що біжить по кільцях циклів і підсвічує блоки.
 * Скрипт підключено перед app.js, щоб ефекти встигли підписатися на події слайдів.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (v, dec = 0) => v.toFixed(dec).replace('.', ',');

  function svgEl(tag, attrs, parent, text) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  // Плавна зміна числових атрибутів SVG-елемента.
  function tween(el, to, dur = 700) {
    const from = {};
    Object.keys(to).forEach((k) => { from[k] = parseFloat(el.getAttribute(k)) || 0; });
    const t0 = performance.now();
    cancelAnimationFrame(el.tw);
    const tick = (t) => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur));
      const e = 1 - (1 - p) ** 3;
      Object.keys(to).forEach((k) => el.setAttribute(k, from[k] + (to[k] - from[k]) * e));
      if (p < 1) el.tw = requestAnimationFrame(tick);
    };
    el.tw = requestAnimationFrame(tick);
  }

  // Лінія «малюється», коли з'являється її крок (data-step найближчого предка), і стирається, коли повертаємося назад.
  function drawOnStep(slide, paths) {
    const k = +paths[0].closest('[data-step]').dataset.step;
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.dataset.len = len;
    });
    slide.addEventListener('step', (e) => {
      paths.forEach((p) => { p.style.strokeDashoffset = e.detail.step >= k ? 0 : p.dataset.len; });
    });
  }

  // Анімація, що грає сама: з кроку k0 tick() викликається кожні 2,5 с, доки не повернемося назад чи не підемо зі слайда; тоді reset().
  function autoplay(slide, k0, tick, reset) {
    let timer = 0;
    const stop = () => {
      clearInterval(timer);
      timer = 0;
      reset();
    };
    slide.addEventListener('step', (e) => {
      if (e.detail.step < k0) stop();
      else if (!timer) timer = setInterval(tick, 2500);
    });
    slide.addEventListener('leave', stop);
  }

  // ---------- Фонова мережа: вузли повільно дрейфують, близькі з'єднуються лініями ----------
  // halo — колір темного ореолу під лініями, щоб світла мережа була видна й на світлому тлі.
  function network(canvas, rgb, count, halo) {
    const ctx = canvas.getContext('2d');
    let nodes = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    let k = 1;
    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      k = (canvas.getBoundingClientRect().width / w || 1) * (window.devicePixelRatio || 1);
      canvas.width = Math.round(w * k);
      canvas.height = Math.round(h * k);
    }
    function seed() {
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        hot: i % 7 === 0,
        ph: Math.random() * Math.PI * 2,
      }));
    }
    function frame(t) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, w, h);
      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });
      const line = (a, b, style, width) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      };
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 180) {
            const a = 1 - d / 180;
            if (halo) line(nodes[i], nodes[j], `rgba(${halo}, ${a * 0.3})`, 5);
            line(nodes[i], nodes[j], `rgba(${rgb}, ${a * (halo ? 0.8 : 0.45)})`, halo ? 1.8 : 1.3);
          }
        }
      }
      nodes.forEach((n) => {
        const r = n.hot ? 4.5 + Math.sin(t / 500 + n.ph) * 1.8 : 3;
        if (halo) {
          ctx.fillStyle = `rgba(${halo}, .35)`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = n.hot ? 'rgba(242, 107, 33, .95)' : `rgba(${rgb}, .9)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        if (raf) return;
        resize();
        if (!nodes.length) seed();
        raf = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
      },
      resize() { if (raf) resize(); },
    };
  }

  $$('canvas.net').forEach((canvas) => {
    const net = network(canvas, canvas.dataset.rgb || '255, 255, 255', +(canvas.dataset.n || 60), canvas.dataset.halo);
    const slide = canvas.closest('.slide');
    slide.addEventListener('enter', () => net.start());
    slide.addEventListener('leave', () => net.stop());
    window.addEventListener('resize', () => net.resize());
  });

  // ---------- Текст, що з'являється слово за словом ----------
  $$('.words').forEach((el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w, i) => `<span class="w" style="--k:${i}">${w}</span>`).join(' ');
    el.closest('.slide').addEventListener('enter', () => {
      el.classList.remove('play');
      void el.offsetWidth;
      el.classList.add('play');
    });
  });

  // ---------- Лінійне продовження проти експоненти (виступ Sohl-Dickstein) ----------
  (() => {
    const svg = $('#s-sd svg.linexp');
    if (!svg) return;
    const X0 = 40;
    const X1 = 620;
    const NOW = 270;
    const f = (x) => 480 - 440 * (Math.exp(4 * (x - X0) / (X1 - X0)) - 1) / (Math.exp(4) - 1);
    const path = (a, b) => {
      let d = '';
      for (let x = a; x <= b + 0.01; x += 5) d += `${x === a ? 'M' : 'L'}${x} ${f(x).toFixed(1)}`;
      return d;
    };
    $('.past', svg).setAttribute('d', path(X0, NOW));
    const exp = $('path.exp', svg);
    exp.setAttribute('d', path(NOW, X1));
    const slope = (f(NOW + 1) - f(NOW - 1)) / 2;
    $('path.lin', svg).setAttribute('d', `M${NOW} ${f(NOW).toFixed(1)}L${X1} ${(f(NOW) + slope * (X1 - NOW)).toFixed(1)}`);
    drawOnStep(svg.closest('.slide'), [exp]);
  })();

  // ---------- Поради: що таке «характерний час експоненти» ----------
  (() => {
    const svg = $('#s-advice svg.exp');
    if (!svg) return;
    const T = 3; // місяців на подвоєння: METR, з 2024 року ≈ 89 днів
    const W = 24; // скільки місяців задача триває сьогоднішніми інструментами
    const X0 = 70;
    const X1 = 690;
    const Y0 = 240;
    const Y1 = 30;
    const x = (t) => X0 + (X1 - X0) * t / 24;
    const y = (v) => Y0 - (Y0 - Y1) * (v - 1) / 255;
    svgEl('line', { class: 'ax', x1: X0, y1: Y0, x2: X1 + 14, y2: Y0 }, svg);
    svgEl('line', { class: 'ax', x1: X0, y1: Y0, x2: X0, y2: Y1 - 14 }, svg);
    [0, 6, 12, 18, 24].forEach((t) => svgEl('text', { class: 'tk', x: x(t), y: Y0 + 28, 'text-anchor': 'middle' }, svg, t === 24 ? '24 міс.' : String(t)));
    let d = '';
    for (let t = 0; t <= 24.001; t += 0.25) d += `${t ? 'L' : 'M'}${x(t).toFixed(1)} ${y(2 ** (t / T)).toFixed(1)}`;
    const curve = svgEl('path', { class: 'curve', d }, svg);
    for (let t = T; t <= 24; t += T) svgEl('circle', { class: 'dbl', cx: x(t), cy: y(2 ** (t / T)), r: 5 }, svg);
    svgEl('text', { class: 'val', x: x(12), y: y(16) - 16, 'text-anchor': 'middle' }, svg, '×16');
    svgEl('text', { class: 'val', x: x(18) - 12, y: y(64) - 6, 'text-anchor': 'end' }, svg, '×64');
    svgEl('text', { class: 'val', x: x(24) - 14, y: y(256) + 8, 'text-anchor': 'end' }, svg, '×256');
    const R1 = 318;
    const R2 = 404;
    const BH = 30;
    svgEl('text', { class: 'bl', x: X0, y: R1 - 12 }, svg, 'Почати зараз сьогоднішніми інструментами');
    svgEl('rect', { class: 'b-now', x: x(0), y: R1, width: x(W) - x(0), height: BH, rx: 5 }, svg);
    svgEl('text', { class: 'bf', x: x(W) + 10, y: R1 + 23 }, svg, '24 міс.');
    // Рядок «почекати» з'являється разом із графіком, і час очікування сам перебирає 6, 9 і 12 місяців, доки не підемо зі слайда.
    const k0 = +svg.closest('[data-step]').dataset.step;
    const row2 = svgEl('g', { class: 'row2', 'data-step': k0, 'data-anim': 'fade' }, svg);
    const mark = svgEl('line', { class: 'mark', x1: x(0), y1: Y0, x2: x(0), y2: Y1 }, row2);
    const markT = svgEl('text', { class: 'mark-t', x: x(0), y: Y1 - 22, 'text-anchor': 'middle' }, row2, 'старт');
    svgEl('text', { class: 'bl', x: X0, y: R2 - 12 }, row2, 'Почекати й зробити новою моделлю');
    const wait = svgEl('rect', { class: 'b-wait', x: x(0), y: R2 + BH / 2 - 3, width: 0, height: 6 }, row2);
    const work = svgEl('rect', { class: 'b-work', x: x(0), y: R2, width: 0, height: BH, rx: 5 }, row2);
    const fin2 = svgEl('text', { class: 'bf', x: x(0), y: R2 + 23 }, row2, '');
    svgEl('text', { class: 'cap', x: X0, y: 480 }, svg, 'Умовно: з кожним подвоєнням ту саму роботу можна зробити вдвічі швидше');
    const slide = svg.closest('.slide');
    drawOnStep(slide, [curve]);
    const waits = [6, 9, 12]; // місяців очікування
    function setWait(n, animate) {
      const end = n + W / 2 ** (n / T);
      fin2.textContent = `${fmt(end, end % 1 ? 1 : 0)} міс.`;
      const set = animate ? tween : (el, to) => Object.entries(to).forEach(([k, v]) => el.setAttribute(k, v));
      set(wait, { width: x(n) - x(0) });
      set(work, { x: x(n), width: x(end) - x(n) });
      set(fin2, { x: x(end) + 10 });
      set(mark, { x1: x(n), x2: x(n) });
      set(markT, { x: x(n) });
    }
    setWait(waits[0], false);
    let i = 0;
    autoplay(slide, k0, () => {
      i = (i + 1) % waits.length;
      setWait(waits[i], true);
    }, () => {
      i = 0;
      setWait(waits[0], false);
    });
  })();

  // ---------- «Від промпту до контексту»: з появою вікна контексту воно переповнюється, а стиснення звільняє місце ----------
  (() => {
    const slide = $('#s-context');
    if (!slide) return;
    const states = ['', 'full', 'compact'];
    let i = 0;
    autoplay(slide, +$('.cw', slide).closest('[data-step]').dataset.step, () => {
      i = (i + 1) % states.length;
      slide.dataset.cw = states[i];
    }, () => {
      i = 0;
      slide.dataset.cw = '';
    });
  })();

  // ---------- «Хто обертає цикл»: крапка біжить по кільцю під блоками, і блок над нею світиться ----------
  (() => {
    const slide = $('#s-loops');
    if (!slide) return;
    const loops = $$('.loop', slide).map((loop) => {
      const ring = $('.ring', loop);
      const [cx, cy, r] = ['cx', 'cy', 'r'].map((k) => +ring.getAttribute(k));
      // Сяйво — розмиті копії блоків під кільцем; видно лише копію блока, під яким крапка.
      const glows = svgEl('g', { class: 'glows' }, loop);
      ring.before(glows);
      const blocks = $$('.node:not(.small)', loop).map((node) => {
        const rect = $('rect', node);
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => +rect.getAttribute(k));
        const glow = svgEl('rect', { x, y, width: w, height: h, rx: rect.getAttribute('rx'), class: node.classList.contains('h') ? 'h' : 'm' }, glows);
        return { node, glow, x, y, w, h };
      });
      const dot = $('.dot', loop);
      return { dot, cx, cy, r, lap: +dot.dataset.lap * 1000, blocks };
    });
    let raf = 0;
    let t0 = 0;
    // Крапка стартує згори й іде за годинниковою стрілкою; блок світиться, поки її центр під ним.
    const frame = (t) => {
      loops.forEach(({ dot, cx, cy, r, lap, blocks }) => {
        const a = (t - t0) / lap * 2 * Math.PI;
        const x = cx + r * Math.sin(a);
        const y = cy - r * Math.cos(a);
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
        blocks.forEach((b) => {
          const under = x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
          b.node.classList.toggle('lit', under);
          b.glow.classList.toggle('lit', under);
        });
      });
      raf = requestAnimationFrame(frame);
    };
    slide.addEventListener('enter', () => {
      if (raf) return;
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    });
    slide.addEventListener('leave', () => {
      cancelAnimationFrame(raf);
      raf = 0;
    });
  })();

  // ---------- Значки в кроках «малюються» лінією, коли крок з'являється ----------
  $$('svg.ico, svg.ico-s').forEach((svg) => {
    if (!svg.closest('[data-step]')) return;
    svg.classList.add('draw-on');
    $$('path, circle, rect, line, polyline', svg).forEach((el) => el.setAttribute('pathLength', 100));
  });
})();
