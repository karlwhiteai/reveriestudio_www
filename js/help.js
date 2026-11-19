/* Reverie Studio help page (help.html). No dependencies, no requests.
   Builds a search index from the page's own answers, suggests answers as you
   type (the ARIA combobox pattern), opens answers from suggestions, links and
   the address, and copies a link to any answer. Without this script the page
   still works: the topics and every answer are plain HTML. */
(() => {
  const root = document.querySelector('.help');
  const input = root && root.querySelector('#help-q');
  if (!root || !input) return;

  root.setAttribute('data-js', 'on');

  const list = root.querySelector('#help-results');
  const menu = root.querySelector('.hmenu');
  const none = root.querySelector('.hmenu .none');
  const noneQ = root.querySelector('.none-q');
  const count = root.querySelector('.hfoot .count');
  const contactLine = root.querySelector('.hfoot .contact-line');
  const clearBtn = root.querySelector('.hclear');
  const hint = root.querySelector('.hfield .kbd');
  const live = root.querySelector('#help-live');
  const topics = root.querySelector('details.topics');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 760px)');
  // The SVG namespace, read from the page's own icons (check.sh flags URLs in scripts).
  const SVG = root.querySelector('svg').namespaceURI;
  const STOP = ['a', 'an', 'the', 'i', 'my', 'me', 'to', 'do', 'does', 'how', 'can', 'is', 'it', 'of', 'in', 'on', 'for', 'and', 'or', 'with', 'what', 'why', 'where', 'when'];
  const FALLBACK = ['job-failed', 'needs-memory', 'logs'];
  const BASE = 'https://reveriestudio.app/help.html#';

  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '');
  const words = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  const hit = (tokens, w) => tokens.some((t) => t.startsWith(w));
  const byId = (id) => { try { return document.getElementById(decodeURIComponent(id)); } catch (err) { return null; } };

  // The index, from the answers themselves (no separate data to keep in step).
  const index = Array.from(root.querySelectorAll('article.qa[id]')).map((a, n) => {
    const title = a.querySelector('summary h3').textContent.trim();
    const section = a.closest('section');
    const h2 = section && section.querySelector('h2');
    const tTok = words(title);
    return {
      id: a.id,
      n,
      title,
      sec: h2 ? h2.textContent.trim() : '',
      tTok,
      tFold: tTok.join(' '),
      kTok: words(a.getAttribute('data-keywords') || ''),
      bTok: words((a.querySelector('.ans') || a).textContent),
    };
  });

  const state = { q: '', open: false, active: -1, results: [], near: [], ws: [] };

  function search(raw) {
    const all = words(raw);
    const keep = all.filter((w) => STOP.indexOf(w) < 0);
    const ws = keep.length ? keep : all;
    state.q = raw;
    state.ws = ws;
    state.active = -1;
    if (!ws.length) {
      Object.assign(state, { open: false, results: [], near: [] });
      return render();
    }
    const phrase = ws.join(' ');
    const ranked = [];
    index.forEach((it) => {
      let rank = -1;
      if (it.tFold.startsWith(phrase) || ws.every((w, i) => it.tTok[i] && (i === ws.length - 1 ? it.tTok[i].startsWith(w) : it.tTok[i] === w))) rank = 0;
      else if (ws.every((w) => hit(it.tTok, w))) rank = 1;
      else if (ws.every((w) => hit(it.tTok, w) || hit(it.kTok, w))) rank = 2;
      else if (ws.every((w) => hit(it.tTok, w) || hit(it.kTok, w) || hit(it.bTok, w))) rank = 3;
      // keywords are listed strongest first: an exact keyword early in the list ranks higher
      let kw = 999;
      for (const w of ws) { const i = it.kTok.indexOf(w); if (i >= 0 && i < kw) kw = i; }
      if (rank >= 0) ranked.push({ it, rank, kw });
    });
    ranked.sort((a, b) => a.rank - b.rank || a.kw - b.kw || a.it.n - b.it.n);
    const results = ranked.slice(0, 8).map((r) => r.it);
    let near = [];
    if (!results.length) {
      const scored = index.map((it) => ({ it, s: ws.filter((w) => w.length > 2 && (hit(it.tTok, w.slice(0, 4)) || hit(it.kTok, w.slice(0, 4)))).length }));
      near = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.it.n - b.it.n).slice(0, 3).map((x) => x.it);
      FALLBACK.forEach((id) => {
        const it = index.find((x) => x.id === id);
        if (near.length < 3 && it && near.indexOf(it) < 0) near.push(it);
      });
    }
    Object.assign(state, { open: true, results, near });
    return render();
  }

  // The title split into text and <mark>ed word starts that match the query.
  function titleNodes(title) {
    const out = [];
    title.split(/(\s+)/).forEach((tok) => {
      const f = fold(tok).replace(/[^a-z0-9]/g, '');
      const w = state.ws.find((x) => f.startsWith(x));
      if (w && /\S/.test(tok)) {
        const lead = tok.match(/^[^A-Za-z0-9À-ɏ]*/)[0];
        // Walk the original characters until the folded match is covered, so an
        // apostrophe inside the word ("isn't") doesn't cut the highlight short.
        let len = lead.length;
        let got = 0;
        while (len < tok.length && got < w.length) { got += fold(tok[len]).replace(/[^a-z0-9]/g, '').length; len++; }
        const mark = document.createElement('mark');
        mark.textContent = tok.slice(0, len);
        out.push(mark);
        if (tok.length > len) out.push(document.createTextNode(tok.slice(len)));
      } else {
        out.push(document.createTextNode(tok));
      }
    });
    return out;
  }

  function shown() { return state.results.length ? state.results : state.near; }

  function render() {
    const items = shown();
    const n = state.results.length;
    const q = state.q.trim();
    list.replaceChildren(...items.map((it, i) => {
      const li = document.createElement('li');
      li.className = 'hopt' + (i === state.active ? ' on' : '');
      li.id = 'hopt-' + it.id;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === state.active ? 'true' : 'false');
      const t = document.createElement('span');
      t.className = 't';
      t.append(...titleNodes(it.title));
      const s = document.createElement('span');
      s.className = 's';
      s.textContent = it.sec;
      li.append(t, s);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); go(it.id, { fromSearch: true }); });
      return li;
    }));
    menu.hidden = !state.open;
    none.hidden = !(state.open && n === 0);
    noneQ.textContent = q;
    count.textContent = n === 1 ? '1 answer' : n + ' answers';
    count.hidden = n === 0;
    contactLine.hidden = n > 0;
    input.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    const active = state.active >= 0 && items[state.active] ? 'hopt-' + items[state.active].id : '';
    if (active) {
      input.setAttribute('aria-activedescendant', active);
      const el = document.getElementById(active);
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
    clearBtn.hidden = state.q.length === 0;
    if (hint) hint.hidden = state.q.length > 0;
    const say = !state.open ? '' : n ? n + (n === 1 ? ' answer' : ' answers') + ' found. Use the up and down arrows to choose.' : 'No answers match. ' + state.near.length + ' related answers listed.';
    if (live.textContent !== say) live.textContent = say;
  }

  function reset() {
    input.value = '';
    Object.assign(state, { q: '', open: false, active: -1, results: [], near: [], ws: [] });
    render();
  }

  // Open an answer (or go to a section): open it, scroll to it, put it in the
  // address, flash it and move focus to its question.
  let flashTimer = 0;
  function go(id, opts = {}) {
    const el = byId(id);
    if (!el || !root.contains(el)) return false;
    const qa = el.matches('article.qa') ? el : null;
    if (qa) { const det = qa.querySelector('details'); if (det) det.open = true; }
    if (topics && narrow.matches && opts.from && topics.contains(opts.from)) topics.open = false;
    if (opts.fromSearch) reset();
    // site.css makes html scroll smoothly, so 'auto' would glide too: a deep
    // link on load jumps ('instant'); Reduce Motion gets 'auto', which site.css
    // then makes a jump as well.
    el.scrollIntoView({ behavior: opts.instant ? 'instant' : reduce.matches ? 'auto' : 'smooth', block: 'start' });
    try { history.replaceState(null, '', '#' + el.id); } catch (err) { /* file:// or sandboxed */ }
    if (qa) {
      root.querySelectorAll('article.qa.flash').forEach((x) => x.classList.remove('flash'));
      qa.classList.add('flash');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => qa.classList.remove('flash'), 1400);
      const s = qa.querySelector('summary');
      if (s) s.focus({ preventScroll: true });
    } else {
      // A section: move focus to its heading so the next Tab continues inside it.
      const h = el.querySelector('h2');
      if (h) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }
    return true;
  }

  function key(e) {
    const items = shown();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      state.active = state.active < 0 ? (d > 0 ? 0 : items.length - 1) : (state.active + d + items.length) % items.length;
      state.open = true;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[state.active >= 0 ? state.active : 0];
      if (pick && state.q.trim()) go(pick.id, { fromSearch: true });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    }
  }

  input.addEventListener('input', () => search(input.value));
  input.addEventListener('keydown', key);
  input.addEventListener('focus', () => { if (state.q.trim() && !state.open) { state.open = true; render(); } });
  // The menu stays open while focus is anywhere in the search (the field, Clear,
  // the contact link in the no-match state) and closes once focus leaves it.
  const box = input.closest('.hsearch');
  box.addEventListener('focusout', (e) => {
    if (e.relatedTarget && box.contains(e.relatedTarget)) return;
    setTimeout(() => {
      if (box.contains(document.activeElement)) return;
      state.open = false;
      state.active = -1;
      render();
    }, 120);
  });
  // A press inside the menu keeps focus in the field, so a slow click still lands.
  menu.addEventListener('mousedown', (e) => { if (!e.target.closest('a')) e.preventDefault(); });
  clearBtn.addEventListener('click', () => { reset(); input.focus(); });

  // "/" focuses the search from anywhere on the page.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    const tag = (t && t.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    e.preventDefault();
    input.focus();
  });

  // In-page links (topics, side index, "see" links) open their answer.
  root.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href').slice(1);
    if (id && go(id, { from: a })) e.preventDefault();
  });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id) go(id); });

  // Copy link, with a toast.
  const toast = document.createElement('div');
  toast.className = 'htoast';
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  document.body.append(toast);
  let toastTimer = 0;
  function showToast(text, ms, icon) {
    clearTimeout(toastTimer);
    toast.hidden = false;
    toast.replaceChildren();
    // Fill the live region a moment after it shows, so screen readers announce it.
    requestAnimationFrame(() => {
      const parts = [];
      if (icon) {
        const svg = document.createElementNS(SVG, 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 24 24');
        const path = document.createElementNS(SVG, 'path');
        path.setAttribute('d', 'M20 6 9 17l-5-5');
        svg.append(path);
        parts.push(svg);
      }
      const span = document.createElement('span');
      span.textContent = text;
      parts.push(span);
      toast.replaceChildren(...parts);
    });
    toastTimer = setTimeout(() => { toast.hidden = true; toast.replaceChildren(); }, ms);
  }
  root.querySelectorAll('article.qa .copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const art = btn.closest('article');
      if (!art) return;
      const url = BASE + art.id;
      const refused = () => showToast('Copy this link: ' + url, 8000, false);
      try {
        navigator.clipboard.writeText(url).then(() => showToast('Link copied', 2600, true), refused);
      } catch (err) {
        refused();
      }
    });
  });

  // Side index: mark the section in view.
  const sideLinks = Array.from(root.querySelectorAll('.side a[href^="#"]'));
  if ('IntersectionObserver' in window && sideLinks.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        sideLinks.forEach((l) => l.setAttribute('aria-current', l.getAttribute('href') === '#' + en.target.id ? 'true' : 'false'));
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    root.querySelectorAll('section.hsec').forEach((s) => io.observe(s));
  }

  // Start: phones fold "All topics"; a wide window focuses the search unless
  // the address names an answer, which opens instead.
  if (topics && narrow.matches) topics.open = false;
  const hash = location.hash.slice(1);
  // A hash that names nothing here (a reserved id, a typo) falls back to the search.
  if (!(hash && go(hash, { instant: true })) && window.matchMedia('(min-width: 761px)').matches) {
    input.focus({ preventScroll: true });
  }
  render();
})();
