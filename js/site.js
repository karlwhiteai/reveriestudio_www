/* The Reverie Studio site. No dependencies, no requests beyond this origin.
   Reads the manifest inlined at build time (#site-data) and paints the media,
   the story picker, the gallery, the carousel, the players and the credits. */
(() => {
  const DATA = JSON.parse(document.getElementById('site-data').textContent);
  const ITEMS = DATA.items;
  const PEAKS = DATA.peaks || {};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const dur = (s) => (s == null ? 'a moment' : s < 90 ? Math.round(s) + ' seconds' : 'about ' + Math.round(s / 60) + ' minutes');
  const secs = (id) => (ITEMS[id] ? ITEMS[id].render_seconds : null);
  const picture = (p) => {
    const wrap = document.createElement('picture');
    const src = document.createElement('source');
    src.type = 'image/webp';
    src.setAttribute('srcset', p.srcset || p.webp);
    if (p.sizes) src.setAttribute('sizes', p.sizes);
    const img = document.createElement('img');
    img.src = p.jpg;
    img.alt = p.alt || '';
    if (p.lazy) { img.loading = 'lazy'; src.loading = 'lazy'; }
    wrap.append(src, img);
    return wrap;
  };
  const STORY_SIZES = '(max-width: 760px) calc(100vw - 32px), 1136px';
  const TILE_SIZES = '(max-width: 760px) calc((100vw - 48px) / 2), (max-width: 1000px) calc((100vw - 64px) / 3), 368px';
  const itemPicture = (it, role, lazy) => {
    const want = it.kind === 'video' && (role === 'small' || role === 'full') ? 'poster' : role;
    const small = it.files.small || it.files.poster_small || it.files.poster;
    const full = it.files.full || it.files.poster;
    const both = small && full && small !== full;
    return picture({
      webp: it.files[want] || full,
      srcset: both ? small + ' 800w, ' + full + ' ' + (want === 'full' ? '1600w' : '1440w') : undefined,
      sizes: want === 'full' ? STORY_SIZES : TILE_SIZES,
      jpg: it.files[want + '_fallback'] || it.files.fallback,
      alt: it.short,
      lazy,
    });
  };

  /* One sound plays at a time across the page. */
  let currentAudio = null;

  function makePlayer(host, id, label) {
    const peaks = PEAKS[id] || [];
    let total = PEAKS[id + '_d'] || 0;
    const audio = new Audio();
    audio.preload = 'none';
    audio.src = ITEMS[id].files.audio;
    host.textContent = '';
    host.classList.add('player');

    const btn = document.createElement('button');
    btn.className = 'ring';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Play ' + label);
    btn.innerHTML = '<svg class="icon"><use href="#i-play"/></svg>';
    const wave = document.createElement('div');
    wave.className = 'wave';
    const bars = peaks.map((v) => {
      const bar = document.createElement('i');
      bar.style.height = Math.max(8, Math.round(v * 100)) + '%';
      wave.appendChild(bar);
      return bar;
    });
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = fmt(total);
    host.append(btn, wave, time);

    const paint = () => {
      const f = audio.currentTime / (audio.duration || total || 1);
      bars.forEach((bar, k) => bar.classList.toggle('on', k / (bars.length || 1) < f));
      time.textContent = fmt(audio.paused && audio.currentTime === 0 ? total : audio.currentTime);
    };
    const set = (on) => {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + label);
      btn.innerHTML = '<svg class="icon"><use href="#i-' + (on ? 'pause' : 'play') + '"/></svg>';
    };
    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) { total = audio.duration; paint(); }
    });
    audio.addEventListener('play', () => set(true));
    audio.addEventListener('pause', () => set(false));
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });
    btn.addEventListener('click', () => {
      if (audio.paused) {
        if (currentAudio && currentAudio !== audio) currentAudio.pause();
        currentAudio = audio;
        audio.play().catch(() => {});
      } else audio.pause();
    });
    wave.addEventListener('click', (e) => {
      const r = wave.getBoundingClientRect();
      if (currentAudio && currentAudio !== audio) currentAudio.pause();
      currentAudio = audio;
      audio.currentTime = ((e.clientX - r.left) / r.width) * (audio.duration || total || 0);
      audio.play().catch(() => {});
    });
    return audio;
  }

  function setCap(el, label, text) {
    el.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = label;
    el.append(strong, ' · ' + text);
  }

  /* Screens, in the hero carousel and under the desktop drawing. */
  function screens(host, ctl, cap, glow) {
    const shots = [...host.querySelectorAll(':scope > picture')];
    let k = 0, timer = null;
    const show = (n) => {
      k = n;
      shots.forEach((el, j) => el.classList.toggle('on', j === n));
      [...ctl.children].forEach((b, j) => {
        b.setAttribute(host.dataset.ctl === 'dots' ? 'aria-current' : 'aria-pressed', String(j === n));
      });
      setCap(cap, shots[n].dataset.label, shots[n].dataset.cap);
      if (glow) {
        glow.querySelector('source').setAttribute('srcset', shots[n].dataset.glowWebp);
        glow.querySelector('img').src = shots[n].dataset.glowJpg;
      }
    };
    shots.forEach((shot, j) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (host.dataset.ctl === 'dots') {
        const label = document.createElement('span');
        label.className = 'visually-hidden';
        label.textContent = shot.dataset.label;
        b.appendChild(label);
      } else {
        b.textContent = shot.dataset.label;
      }
      b.setAttribute(host.dataset.ctl === 'dots' ? 'aria-current' : 'aria-pressed', 'false');
      b.addEventListener('click', () => { show(j); if (timer) clearInterval(timer); });
      ctl.appendChild(b);
    });
    show(0);
    if (!reduce && glow) timer = setInterval(() => show((k + 1) % shots.length), 6000);
  }
  screens($('#heroScreen'), $('#heroDots'), $('#heroCap'), $('#glowImg'));
  screens($('#deskScreen'), $('#deskSeg'), $('#deskCap'), null);

  makePlayer($('#heroPlayer'), DATA.heroNarration, 'the welcome narration');

  /* Stories: one idea, every medium. */
  (() => {
    const chips = $('#storyChips'), pic = $('#storyPicture'), vid = $('#storyVid'),
      side = $('#storySide'), sw = $('#mediaSwitch'), meta = $('#mediaMeta');
    let mode = 'image', story = null;

    function setMode(m, byUser) {
      mode = m === 'video' && story.video ? 'video' : 'image';
      [...sw.children].forEach((b) => {
        b.hidden = b.dataset.m === 'video' && !story.video;
        b.setAttribute('aria-pressed', String(b.dataset.m === mode));
      });
      if (mode === 'video') {
        pic.hidden = true;
        vid.hidden = false;
        if (byUser && !reduce) vid.play().catch(() => {});
        meta.textContent = 'Video · 10 s · made in ' + dur(secs(story.video));
      } else {
        vid.pause();
        vid.hidden = true;
        pic.hidden = false;
        meta.textContent = 'Image · made in ' + dur(secs(story.image));
      }
    }

    function panel(kind, colour, title, text, extra) {
      const el = document.createElement('div');
      el.className = 'panel';
      const row = document.createElement('div');
      row.className = 'row';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = colour;
      const label = document.createElement('span');
      label.className = 'kind';
      label.textContent = kind;
      row.append(dot, label);
      el.appendChild(row);
      if (title) { const h = document.createElement('h3'); h.textContent = title; el.appendChild(h); }
      if (text) {
        const p = document.createElement('p');
        p.className = 'prompt';
        p.textContent = text;
        el.appendChild(p);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'linkbtn';
        b.textContent = 'Show the full prompt';
        b.addEventListener('click', () => {
          const open = p.classList.toggle('open');
          b.textContent = open ? 'Show less' : 'Show the full prompt';
        });
        el.appendChild(b);
      }
      if (extra) el.appendChild(extra);
      return el;
    }

    function pick(n) {
      story = DATA.stories[n];
      [...chips.children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === n)));
      const image = ITEMS[story.image];
      pic.textContent = '';
      const built = itemPicture(image, 'full');
      [...built.children].forEach((c) => { if (c.tagName === 'IMG') c.alt = story.name; pic.appendChild(c); });
      if (story.video) {
        const v = ITEMS[story.video];
        vid.poster = v.files.poster;
        vid.src = v.files.video;
      } else {
        vid.removeAttribute('src');
      }
      side.textContent = '';
      side.appendChild(panel('Picture' + (story.video ? ' and moving shot' : '') + ' · Mirage', 'var(--mark-mirage)', null, image.prompt));
      if (story.song) {
        const song = ITEMS[story.song];
        const pl = document.createElement('div');
        makePlayer(pl, story.song, song.short);
        side.appendChild(panel('Song · Vibe · made in ' + dur(secs(story.song)), 'var(--mark-vibe)', song.short, song.prompt, pl));
      }
      if (story.narration) {
        const vo = ITEMS[story.narration];
        const pl = document.createElement('div');
        makePlayer(pl, story.narration, 'the narration');
        const el = panel('Narration · Echo · made in ' + dur(secs(story.narration)), 'var(--mark-echo)', null, null, pl);
        const quote = document.createElement('p');
        quote.className = 'prompt open';
        quote.textContent = '“' + vo.prompt + '”';
        el.insertBefore(quote, pl);
        side.appendChild(el);
      }
      setMode(story.video ? 'video' : 'image');
    }

    DATA.stories.forEach((st, j) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = st.name;
      b.addEventListener('click', () => pick(j));
      chips.appendChild(b);
    });
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.hidden) setMode(b.dataset.m, true);
    });
    pick(0);
  })();

  /* More examples: one large preview above a grid of thumbnails. */
  (() => {
    const grid = $('#gallery'), wide = window.matchMedia('(min-width: 761px)');
    const pPic = $('#gpPicture'), pVid = $('#gpVid'), pBadge = $('#gpBadge'),
      pTitle = $('#gpTitle'), pMeta = $('#gpMeta'), pPrompt = $('#gpPrompt'),
      pMore = $('#gpMore'), preview = $('#gPreview');
    const tiles = [];
    pMore.addEventListener('click', () => {
      const open = pPrompt.classList.toggle('open');
      pMore.textContent = open ? 'Show less' : 'Show the full prompt';
    });
    function select(id, scroll) {
      const it = ITEMS[id], isVideo = it.kind === 'video';
      tiles.forEach((pair) => pair[1].setAttribute('aria-pressed', String(pair[0] === id)));
      pBadge.textContent = isVideo ? 'VIDEO' : 'IMAGE';
      pTitle.textContent = it.short;
      pMeta.textContent = (isVideo ? '10 s video · made in ' : 'Image · made in ') + dur(secs(id)) + ' on a Mac Studio';
      pPrompt.textContent = it.prompt;
      pPrompt.classList.remove('open');
      pMore.textContent = 'Show the full prompt';
      if (isVideo) {
        pPic.hidden = true;
        if (wide.matches) {
          pVid.hidden = false;
          pVid.poster = it.files.poster;
          pVid.src = it.files.video;
          if (!reduce) pVid.play().catch(() => {}); else pVid.controls = true;
        } else {
          pVid.hidden = true;
          pVid.removeAttribute('src');
        }
      } else {
        pVid.pause();
        pVid.removeAttribute('src');
        pVid.load();
        pVid.hidden = true;
        pPic.hidden = false;
        pPic.textContent = '';
        [...itemPicture(it, 'small', true).children].forEach((c) => pPic.appendChild(c));
      }
      if (scroll && wide.matches) {
        const r = preview.getBoundingClientRect();
        if (r.top < 64 || r.top > window.innerHeight * 0.5) {
          preview.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }
      }
    }
    DATA.gallery.forEach((id) => {
      const it = ITEMS[id], isVideo = it.kind === 'video';
      const tile = document.createElement('figure');
      tile.className = 'tile';
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      const box = document.createElement('div');
      box.className = 'mediabox';
      [...itemPicture(it, 'small', true).children].forEach((c) => box.appendChild(c));
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = isVideo ? 'VIDEO' : 'IMAGE';
      box.appendChild(badge);
      let on = () => {}, off = () => {};
      if (isVideo) {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
        v.src = it.files.video;
        box.appendChild(v);
        on = () => { tile.classList.add('playing'); v.play().catch(() => {}); };
        off = () => { tile.classList.remove('playing'); v.pause(); };
        if (!reduce) {
          tile.addEventListener('mouseenter', on);
          tile.addEventListener('mouseleave', off);
          tile.addEventListener('focus', on);
          tile.addEventListener('blur', off);
        } else {
          v.controls = true;
        }
      }
      tile.setAttribute('aria-label', (wide.matches ? 'Show ' : 'Play ') + it.short);
      const act = () => { if (wide.matches) select(id, true); else if (isVideo) (tile.classList.contains('playing') ? off() : on()); };
      tile.addEventListener('click', act);
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); }
      });
      const cap = document.createElement('figcaption');
      cap.className = 'cap';
      const name = document.createElement('span');
      name.textContent = it.short;
      const note = document.createElement('span');
      note.textContent = (isVideo ? '10 s video · ' : '') + dur(secs(id));
      cap.append(name, note);
      tile.append(box, cap);
      grid.appendChild(tile);
      tiles.push([id, tile]);
    });
    select(DATA.gallery[0], false);
    wide.addEventListener('change', () => {
      if (wide.matches) select(DATA.gallery[0], false);
      else { pVid.pause(); tiles.forEach((pair) => pair[1].removeAttribute('aria-pressed')); }
    });
  })();

  /* The credits line, from the manifest. */
  (() => {
    const order = ['image', 'video', 'song', 'narration'];
    const names = { image: 'Images', video: 'Video', song: 'Music', narration: 'Speech' };
    const byKind = new Map();
    Object.keys(ITEMS).forEach((id) => {
      const it = ITEMS[id];
      if (!byKind.has(it.kind)) byKind.set(it.kind, new Map());
      byKind.get(it.kind).set(it.model, it.licence);
    });
    const parts = order.filter((k) => byKind.has(k)).map((k) => {
      const licences = [...byKind.get(k)].map(([model, licence]) => model + ' (' + licence + ')');
      return names[k] + ': ' + licences.join(' and ') + '.';
    });
    const placeholder = Object.values(ITEMS).find((it) => it.licence_placeholder);
    $('#credits').textContent = 'Every example on this page was made with Reverie Studio on a ' + DATA.mac + '. ' +
      parts.join(' ') + (placeholder ? ' ' + placeholder.replace_before_launch + ', and those songs are placeholders to be replaced before launch.' : '');
  })();
})();
