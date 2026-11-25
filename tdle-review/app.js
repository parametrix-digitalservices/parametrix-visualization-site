/* Draft review page — storyboard, full cuts, clips, timecoded notes, music ratings.
   Settings live in config.js; you shouldn't need to edit this file. */
(function () {
  'use strict';

  var C = window.REVIEW_CONFIG || {};
  var CLIPS = (C.clips || []).filter(function (c) { return c && c.id; });
  var MUSIC = (C.music || []).filter(function (m) { return m && m.id; });
  var FULL = (C.fullCuts || []).filter(function (f) { return f && f.id; });
  var REMOTE = /^https:\/\//.test(C.backendUrl || '');
  var FPS = Math.round(Number(C.fps) || 30);
  var SALT = 'tdle-review:';
  var NS = 'review:' + location.pathname.replace(/index\.html$/, '') + ':';

  var store = {
    get: function (k) { try { return localStorage.getItem(NS + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(NS + k); } catch (e) {} }
  };

  var state = {
    name: '', pw: '', items: [], busy: false, lastSync: 0,
    sort: store.get('sort') || 'timecode',
    showOlder: store.get('older') !== '0',
    playThrough: store.get('playthrough') === '1'
  };
  var views = [];          // one per full cut / clip / track
  var byId = {};           // item id -> view
  var built = false;

  /* ---------- small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var hr = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return hr ? hr + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
  }
  function timecode(s) {
    var f = Math.round((Number(s) || 0) * FPS);
    var ff = f % FPS, tot = Math.floor(f / FPS);
    return Math.floor(tot / 3600) + ':' + pad(Math.floor(tot % 3600 / 60)) + ':' + pad(tot % 60) + ':' + pad(ff);
  }
  function fmtDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fullDate(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(); }
  function relTime(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var sec = (Date.now() - d.getTime()) / 1000;
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + ' min ago';
    if (sec < 86400) return Math.floor(sec / 3600) + ' hr ago';
    if (sec < 172800) return 'yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  var AVATAR = ['#333333', '#0073BB', '#F36E21', '#3FB549', '#676768', '#ED715D', '#9A7400', '#005A8F'];
  function colorFor(name) {
    var s = String(name || '').toLowerCase(), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR[n % AVATAR.length];
  }
  function nameKey(n) { return String(n || '').trim().toLowerCase(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  var toastTimer;
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast' + (isErr ? ' err' : ''); }, isErr ? 6000 : 2200);
  }

  /* ---------- password hashing (Web Crypto, with a plain-JS fallback for file://) ---------- */
  function sha256(str) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
    }
    return Promise.resolve(sha256js(str));
  }
  function sha256js(str) {
    function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
    var s = unescape(encodeURIComponent(str)), K = [], H = [], n = 2, c = 0, i, j;
    while (c < 64) {
      var prime = true;
      for (i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (prime) {
        if (c < 8) H[c] = ((Math.pow(n, 1 / 2) % 1) * 4294967296) | 0;
        K[c++] = ((Math.pow(n, 1 / 3) % 1) * 4294967296) | 0;
      }
      n++;
    }
    var bytes = [];
    for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
      for (i = 16; i < 64; i++) {
        var a0 = w[i - 15], b0 = w[i - 2];
        w[i] = (w[i - 16] + (ror(a0, 7) ^ ror(a0, 18) ^ (a0 >>> 3)) + w[i - 7] + (ror(b0, 17) ^ ror(b0, 19) ^ (b0 >>> 10))) | 0;
      }
      var a = H[0], b = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (j = 0; j < 64; j++) {
        var t1 = (hh + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0;
        var t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    return H.map(function (x) { return (x >>> 0).toString(16).padStart(8, '0'); }).join('');
  }

  /* ---------- storage: Google Sheet (shared) or this browser (preview) ---------- */
  var local = {
    read: function () { try { return JSON.parse(store.get('items') || '[]'); } catch (e) { return []; } },
    write: function (a) { store.set('items', JSON.stringify(a)); }
  };

  function remote(method, payload) {
    var req;
    if (method === 'GET') {
      var sep = C.backendUrl.indexOf('?') >= 0 ? '&' : '?';
      req = fetch(C.backendUrl + sep + 'action=list&key=' + encodeURIComponent(state.pw) + '&t=' + Date.now(), { redirect: 'follow' });
    } else {
      // text/plain body keeps this a "simple" request, which Apps Script accepts cross-origin
      req = fetch(C.backendUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(Object.assign({ key: state.pw }, payload)) });
    }
    return req.then(function (res) {
      return res.json().catch(function () {
        throw new Error('The feedback sheet sent back something unexpected. Check that the web app is deployed with access set to "Anyone".');
      });
    }, function () {
      throw new Error("Couldn't reach the feedback sheet. Check your connection, then try again.");
    }).then(function (j) {
      if (!j || !j.ok) {
        var err = new Error(j && j.error === 'auth'
          ? "The feedback sheet didn't accept the password. The PASSWORD in Code.gs must match the page password."
          : 'Feedback sheet error: ' + ((j && j.error) || 'unknown'));
        err.code = j && j.error;
        throw err;
      }
      return j;
    });
  }

  var api = {
    list: function () {
      if (!REMOTE) return Promise.resolve(local.read());
      return remote('GET').then(function (j) { return j.items || []; });
    },
    add: function (item) {
      if (!REMOTE) {
        var it = Object.assign({}, item, { id: uid(), created: new Date().toISOString(), status: '' });
        var a = local.read(); a.push(it); local.write(a);
        return Promise.resolve(it);
      }
      return remote('POST', { action: 'add', item: item }).then(function (j) { return j.item; });
    },
    setStatus: function (id, status) {
      if (!REMOTE) {
        var a = local.read(), hit = null;
        a.forEach(function (x) { if (x.id === id) { x.status = status; hit = x; } });
        local.write(a);
        return Promise.resolve(hit);
      }
      return remote('POST', { action: 'status', id: id, status: status }).then(function (j) { return j.item; });
    }
  };

  function normalize(x) {
    var sec = x.seconds === '' || x.seconds == null ? null : Number(x.seconds);
    return {
      id: String(x.id || ''), created: x.created || '', kind: x.kind || 'comment', section: x.section || '',
      itemId: String(x.itemId || ''), itemTitle: x.itemTitle || '', version: String(x.version || ''),
      name: String(x.name || ''), seconds: isFinite(sec) ? sec : null, timecode: x.timecode || '',
      rating: Number(x.rating) || 0, comment: String(x.comment == null ? '' : x.comment), status: String(x.status || '')
    };
  }

  /* ---------- gate ---------- */
  function unlock(name, pw, silent) {
    var expected = String(C.passwordHash || '').trim().toLowerCase();
    return (expected ? sha256(SALT + pw) : Promise.resolve('')).then(function (hash) {
      if (hash !== expected) {
        if (silent) store.del('pw');
        else { $('#gate-error').textContent = "That password doesn't match."; $('#gate-pw').select(); }
        return;
      }
      state.name = String(name).trim().slice(0, 60);
      state.pw = pw;
      store.set('name', state.name);
      store.set('pw', pw);
      $('#gate').hidden = true;
      $('#app').hidden = false;
      if (!built) build();
      $('#who').textContent = state.name;
      refresh(false);
    });
  }

  function initGate() {
    document.title = C.title || 'Draft Review';
    $('#gate-title').textContent = C.title || 'Draft Review';
    $('#gate-sub').textContent = C.subtitle || '';
    var n = store.get('name'), p = store.get('pw');
    if (n) $('#gate-name').value = n;
    $('#gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#gate-name').value.trim();
      if (!name) { $('#gate-error').textContent = 'Add your name so the team knows who left each note.'; return; }
      $('#gate-error').textContent = '';
      unlock(name, $('#gate-pw').value, false);
    });
    if (n && p) unlock(n, p, true);
    else (n ? $('#gate-pw') : $('#gate-name')).focus();
  }

  /* ---------- Vimeo: lets a vimeo.com link stand in for a video file ---------- */
  // Accepts vimeo.com/123456789, vimeo.com/123456789/abcdef12 (unlisted), player.vimeo.com/video/123456789?h=abcdef12,
  // vimeo.com/manage/videos/123456789/abcdef12, channel and showcase links.
  function parseVimeo(url) {
    if (!/vimeo\.com\//i.test(url || '')) return null;
    var m = /vimeo\.com\/(?:.*?\/)?(?:video\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/i.exec(url);
    if (!m) return null;
    var hq = /[?&]h=([0-9a-f]+)/i.exec(url);
    return { id: m[1], hash: m[2] || (hq && hq[1]) || '' };
  }

  var vimeoSdk = null, vimeoPlayers = [];
  function loadVimeoSdk() {
    if (window.Vimeo && window.Vimeo.Player) return Promise.resolve(window.Vimeo);
    if (!vimeoSdk) vimeoSdk = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      var timer = setTimeout(function () { reject(new Error('timeout')); }, 20000);
      sc.src = 'https://player.vimeo.com/api/player.js';
      sc.onload = function () { clearTimeout(timer); if (window.Vimeo && window.Vimeo.Player) resolve(window.Vimeo); else reject(new Error('no sdk')); };
      sc.onerror = function () { clearTimeout(timer); reject(new Error('blocked')); };
      document.head.appendChild(sc);
    });
    return vimeoSdk;
  }

  // Pause every other video/track on the page (files and Vimeo players alike).
  function pauseAllMedia(except) {
    document.querySelectorAll('#app video, #app audio').forEach(function (m) { if (m !== except && !m.paused) m.pause(); });
    vimeoPlayers.forEach(function (p) { if (p !== except && !p.paused) p.pause(); });
  }

  // Wraps a Vimeo embed so the rest of the page can treat it like a <video>:
  // currentTime / duration / paused, play() / pause(), and the same events.
  function VimeoMedia(info, opts) {
    opts = opts || {};
    var self = this;
    this.isVimeo = true; this.tagName = 'VIDEO';
    this._t = 0; this._ls = {}; this._pendingSeek = null;
    this.duration = NaN; this.paused = true; this.ended = false; this.player = null;
    var q = 'dnt=1&title=0&byline=0&portrait=0&pip=0' + (info.hash ? '&h=' + info.hash : '') + (opts.muted ? '&muted=1' : '');
    var el = this.el = document.createElement('iframe');
    el.src = 'https://player.vimeo.com/video/' + info.id + '?' + q;
    el.className = 'vimeo-frame';
    el.allow = 'autoplay; fullscreen; picture-in-picture';
    el.setAttribute('allowfullscreen', '');
    el.title = opts.title || 'Video';
    if (opts.lazy) el.loading = 'lazy';
    vimeoPlayers.push(this);
    loadVimeoSdk().then(function (Vimeo) {
      var p = self.player = new Vimeo.Player(el);
      var at = function (d) {
        if (d && typeof d.seconds === 'number') self._t = d.seconds;
        if (d && d.duration) self._setDuration(d.duration);
      };
      p.on('play', function (d) { at(d); self.paused = false; self.ended = false; pauseAllMedia(self); self._emit('play'); });
      p.on('playing', function (d) { at(d); self.paused = false; self._emit('playing'); });
      p.on('pause', function (d) { at(d); self.paused = true; self._emit('pause'); });
      p.on('ended', function (d) {
        at(d); var was = self.paused;
        self.paused = true; self.ended = true;
        if (!was) self._emit('pause');
        self._emit('ended');
      });
      p.on('timeupdate', function (d) { at(d); self._emit('timeupdate'); });
      p.on('seeked', function (d) { at(d); self._emit('seeked'); });
      p.on('bufferstart', function () { self._emit('waiting'); });
      p.on('durationchange', function (d) { if (d && d.duration) self._setDuration(d.duration); });
      p.on('loaded', function () { p.getDuration().then(function (d) { self._setDuration(d); }).catch(function () {}); });
      if (opts.muted) p.setVolume(0).catch(function () {});
      return p.ready().then(function () { return p.getDuration(); }).then(function (d) {
        if (d > 0) return self._setDuration(d);
        // A password-protected video reports no length until someone unlocks it in the player.
        self.locked = true;
        self._emit('locked');
        var poll = setInterval(function () {
          if (!self.player || self.duration > 0) return clearInterval(poll);
          p.getDuration().then(function (dd) { if (dd > 0) { clearInterval(poll); self._setDuration(dd); } }).catch(function () {});
        }, 2000);
      });
    }).catch(function () { self.failed = true; self._emit('error'); });
  }
  VimeoMedia.prototype = {
    addEventListener: function (type, fn) { (this._ls[type] = this._ls[type] || []).push(fn); },
    removeEventListener: function (type, fn) { this._ls[type] = (this._ls[type] || []).filter(function (f) { return f !== fn; }); },
    _emit: function (type) {
      var self = this;
      (this._ls[type] || []).slice().forEach(function (fn) {
        try { fn.call(self, { type: type, target: self }); } catch (e) { setTimeout(function () { throw e; }); }
      });
    },
    play: function () {
      pauseAllMedia(this);
      return this.player ? this.player.play() : Promise.reject(new Error('not ready'));
    },
    pause: function () { if (this.player) this.player.pause().catch(function () {}); },
    _setDuration: function (d) {
      if (!(d > 0)) return;
      this.duration = d;
      if (this._metaSent) return;
      this._metaSent = true;
      if (this.locked) { this.locked = false; this._emit('unlocked'); }
      this._emit('loadedmetadata');
      if (this._pendingSeek != null) { var t = this._pendingSeek; this._pendingSeek = null; this.currentTime = t; }
    },
    closest: function (sel) { return this.el.closest(sel); },
    getBoundingClientRect: function () { return this.el.getBoundingClientRect(); },
    scrollIntoView: function (o) { this.el.scrollIntoView(o); },
    remove: function () { this.el.remove(); },
    destroy: function () {
      var self = this;
      vimeoPlayers = vimeoPlayers.filter(function (p) { return p !== self; });
      if (this.player) this.player.destroy().catch(function () {});
      this.el.remove();
    }
  };
  Object.defineProperty(VimeoMedia.prototype, 'currentTime', {
    get: function () { return this._t; },
    set: function (t) {
      var self = this;
      this._t = t;
      if (!this.player || !(this.duration > 0)) { this._pendingSeek = t; return; }
      // Vimeo doesn't always announce a jump made while paused, so report it ourselves.
      this.player.setCurrentTime(t).then(function (sec) { if (typeof sec === 'number') self._t = sec; self._emit('seeked'); }).catch(function () {});
    }
  });

  /* ---------- build page ---------- */
  function build() {
    built = true;
    $('#app-title').textContent = C.title || '';
    $('#app-sub').textContent = C.subtitle || '';
    $('#draft-label').textContent = C.draftLabel || 'Draft';
    $('#intro').textContent = C.intro || '';
    $('#mode-banner').hidden = REMOTE;

    // full cuts: newest first; the latest gets the spotlight, earlier ones fold away
    FULL.forEach(function (f, i) {
      var card = buildVideoCard(f, 'full', i);
      if (i === 0) $('#full-latest').append(card);
      else $('#full-older-list').append(card);
    });
    $('#full-older').hidden = FULL.length < 2;
    $('#full-older-count').textContent = String(FULL.length - 1);
    if (!FULL.length) $('#fullcut').hidden = true;

    if (C.clipNotice) { $('#clip-notice').textContent = C.clipNotice; $('#clip-notice').hidden = false; }
    CLIPS.forEach(function (c, i) { $('#clip-list').append(buildVideoCard(c, 'clip', i)); });
    MUSIC.forEach(function (m, i) { $('#music-list').append(buildTrack(m, i)); });
    if (!MUSIC.length) $('#music').hidden = true;
    buildStoryboard();
    buildToc();

    // toolbar
    document.querySelectorAll('.seg [data-sort]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.sort === state.sort);
      b.addEventListener('click', function () {
        state.sort = b.dataset.sort; store.set('sort', state.sort);
        document.querySelectorAll('.seg [data-sort]').forEach(function (x) { x.classList.toggle('on', x.dataset.sort === state.sort); });
        renderAll();
      });
    });
    var older = $('#opt-older'); older.checked = state.showOlder;
    older.addEventListener('change', function () { state.showOlder = older.checked; store.set('older', older.checked ? '1' : '0'); renderAll(); });
    var pt = $('#opt-playthrough'); pt.checked = state.playThrough;
    pt.addEventListener('change', function () { state.playThrough = pt.checked; store.set('playthrough', pt.checked ? '1' : '0'); });

    $('#btn-refresh').addEventListener('click', function () { refresh(false); });
    $('#btn-lock').addEventListener('click', function () { store.del('pw'); location.reload(); });
    $('#btn-rename').addEventListener('click', function () {
      var n = window.prompt('Your name, as it appears on your notes:', state.name);
      if (n && n.trim()) { state.name = n.trim().slice(0, 60); store.set('name', state.name); $('#who').textContent = state.name; renderAll(); }
    });

    // only one video or track plays at a time
    document.addEventListener('play', function (e) { pauseAllMedia(e.target); }, true);

    initAudition();
    setInterval(function () { if (REMOTE && !document.hidden) refresh(true); }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (REMOTE && !document.hidden && Date.now() - state.lastSync > 30000) refresh(true);
    });

    // a link like …/tdle-review/#clip-map opens straight to that clip once signed in
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) setTimeout(function () { target.scrollIntoView(); }, 60);
    }
  }

  function placeholder(title, line, path) {
    return h('div', { class: 'placeholder' }, h('div', null, h('b', { text: title }), line, path ? h('div', null, h('code', { text: path })) : null));
  }

  function anchorOf(v) { return (v.kind === 'clip' ? 'clip-' : v.kind === 'full' ? 'cut-' : 'music-') + v.cfg.id; }
  function titleOf(v) {
    if (v.kind === 'full') return (v.cfg.title || 'Full cut') + (v.cfg.version ? ' · ' + v.cfg.version : '');
    return v.num + ' ' + v.cfg.title;
  }

  function copyLink(v) {
    var url = location.href.split('#')[0] + '#' + anchorOf(v);
    var done = function () { toast('Link copied — it opens straight to ' + (v.kind === 'clip' ? 'clip ' + v.num : 'this cut')); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
    else window.prompt('Copy this link:', url);
  }

  // A video with notes beside it — used for both the clips and the full cuts.
  function buildVideoCard(cfg, kind, i) {
    var isFull = kind === 'full';
    var v = { kind: kind, cfg: cfg, num: isFull ? '' : pad(i + 1), media: null, failed: false, latest: isFull && i === 0 };
    views.push(v); byId[cfg.id] = v;
    v.durEl = h('span');
    var title = isFull ? (cfg.title || 'Full cut') : cfg.title;
    var card = h('article', { class: 'card ' + kind, id: anchorOf(v) },
      h('header', { class: 'card-head' },
        isFull ? null : h('span', { class: 'num', text: v.num }),
        h('div', { class: 'grow' },
          h('h3', { text: title }),
          h('div', { class: 'meta' },
            cfg.version ? h('span', { class: 'chip chip-dark', text: cfg.version }) : null,
            v.latest && FULL.length > 1 ? h('span', { class: 'chip chip-red', text: 'Latest' }) : null,
            isFull && C.fullCutBadge ? h('span', { class: 'chip chip-good', text: C.fullCutBadge }) : null,
            !isFull && C.clipBadge && cfg.src ? h('span', { class: 'chip chip-quiet', title: C.clipNotice || '', text: C.clipBadge }) : null,
            cfg.updated ? h('span', { text: 'Updated ' + fmtDate(cfg.updated) }) : null,
            isFull && cfg.music ? h('span', { text: 'Music: ' + cfg.music }) : null,
            v.durEl)),
        h('button', { class: 'linkish copy-link', type: 'button', title: 'Copy a direct link to this ' + (isFull ? 'cut' : 'clip'), text: 'Copy link', onclick: function () { copyLink(v); } })));

    var player = h('div', { class: 'player' });
    var playerCol = h('div', { class: 'player-col' }, player);
    var vimeo = parseVimeo(cfg.src);
    v.vimeo = !!vimeo;
    if (cfg.src) {
      var vid = v.media = vimeo
        ? new VimeoMedia(vimeo, { title: title, lazy: isFull && !v.latest })
        : h('video', { controls: true, preload: isFull && !v.latest ? 'none' : 'metadata', playsinline: true, src: cfg.src, poster: cfg.poster || null });
      player.append(vimeo ? vid.el : vid);
      vid.addEventListener('error', function () {
        v.failed = true;
        if (v.markers) v.markers.hidden = true;
        if (vimeo) {
          // keep Vimeo's own message visible (it explains privacy problems) and add what to check
          playerCol.insertBefore(h('p', { class: 'notes warn', text: "The Vimeo player couldn't be set up. Check the link in config.js, and that the video's Vimeo embed settings allow parametrix-digitalservices.github.io. Notes still work, but without timecodes." }), player.nextSibling);
        } else {
          vid.remove();
          player.append(placeholder(title, "This video couldn't be loaded. Check that the file exists:", cfg.src));
        }
        renderStoryboardMeta();
      });
      if (vimeo) {
        var lockHint = h('p', { class: 'notes', text: 'This video is password-protected on Vimeo. Enter its password in the player to watch. Timecodes start working once it’s unlocked.' });
        vid.addEventListener('locked', function () { playerCol.insertBefore(lockHint, player.nextSibling); });
        vid.addEventListener('unlocked', function () { lockHint.remove(); });
      }
      vid.addEventListener('loadedmetadata', function () {
        v.duration = vid.duration;
        v.durEl.textContent = fmtTime(vid.duration);
        renderMarkers(v);
        renderStoryboardMeta();
      });
      if (!isFull) vid.addEventListener('ended', function () { if (state.playThrough) playNextClip(v); });

      v.playhead = h('div', { class: 'playhead' });
      v.markers = h('div', { class: 'markers', title: 'Notes on this video — click a dot to jump to it' }, v.playhead);
      v.markers.addEventListener('click', function (e) {
        if (e.target !== v.markers || !v.duration) return;
        var r = v.markers.getBoundingClientRect();
        seek(v, (e.clientX - r.left) / r.width * v.duration);
      });
      vid.addEventListener('timeupdate', function () {
        if (v.duration) v.playhead.style.left = (vid.currentTime / v.duration * 100) + '%';
      });
      playerCol.append(v.markers);
    } else {
      player.append(placeholder(title, isFull ? 'Not posted yet. The edited video will appear here.' : 'Not posted yet. You can still leave notes.'));
    }
    if (cfg.notes) playerCol.append(h('p', { class: 'notes', text: cfg.notes }));

    card.append(h('div', { class: 'clip-body' }, playerCol, h('div', { class: 'feedback-col' }, buildFeedback(v))));
    return card;
  }

  function buildTrack(m, i) {
    var v = { kind: 'music', cfg: m, num: m.label || String.fromCharCode(65 + i), media: null, failed: false };
    views.push(v); byId[m.id] = v;
    v.durEl = h('span');
    v.avgEl = h('div', { class: 'avg' });
    var card = h('article', { class: 'card track', id: anchorOf(v) },
      h('header', { class: 'card-head' },
        h('span', { class: 'num', text: v.num }),
        h('div', { class: 'grow' },
          h('h3', { text: m.title }),
          h('div', { class: 'meta' }, m.artist ? h('span', { text: m.artist }) : null, m.tags ? h('span', { text: m.tags }) : null, v.durEl)),
        v.avgEl));

    var body = h('div', { class: 'track-body' });
    if (m.src) {
      var au = v.media = h('audio', { controls: true, preload: 'metadata', src: m.src });
      body.append(au);
      au.addEventListener('loadedmetadata', function () { v.duration = au.duration; v.durEl.textContent = fmtTime(au.duration); });
      au.addEventListener('error', function () {
        v.failed = true;
        au.replaceWith(h('div', { class: 'audio-missing' }, "This track couldn't be loaded. Check that the file exists: ", h('code', { text: m.src })));
        if (v.tryBtn) v.tryBtn.hidden = true;
      });
    } else {
      body.append(h('div', { class: 'audio-missing', text: 'Track not posted yet.' }));
    }
    if (m.notes) body.append(h('p', { class: 'notes', text: m.notes }));

    v.stars = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Your rating' });
    for (var s = 1; s <= 5; s++) (function (s) {
      v.stars.append(h('button', { type: 'button', role: 'radio', 'aria-label': s + (s > 1 ? ' stars' : ' star'), title: s + ' / 5', text: '★', onclick: function () { rate(v, s); } }));
    })(s);
    v.rateStatus = h('span', { class: 'rate-status' });
    v.ratersEl = h('div', { class: 'raters' });
    body.append(h('div', null, h('div', { class: 'rate-row' }, h('span', { class: 'lbl', text: 'Your rating' }), v.stars, v.rateStatus), v.ratersEl));

    if (m.src && (CLIPS.some(function (c) { return c.src; }) || FULL.some(function (f) { return f.src; }))) {
      v.tryBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '▶ Try with the video', onclick: function () { openAudition(v); } });
      body.append(h('div', { class: 'track-actions' }, v.tryBtn));
    }
    body.append.apply(body, buildFeedback(v));
    card.append(body);
    return card;
  }

  function buildFeedback(v) {
    var media = v.media, isVideo = v.kind !== 'music';
    var ta = h('textarea', { maxlength: '2000', 'aria-label': 'Your note',
      placeholder: v.kind === 'clip' ? 'Add a note on this clip… (Ctrl+Enter to post)'
        : v.kind === 'full' ? 'Add a note on the full cut… (Ctrl+Enter to post)'
        : 'What works, what doesn’t? (Ctrl+Enter to post)' });
    var tcVal = h('span', { class: 'tc', text: '0:00' });
    var tcBox = h('input', { type: 'checkbox' });
    var btn = h('button', { class: 'btn btn-dark btn-sm', type: 'submit', text: 'Post note' });
    var left = media ? h('label', { class: 'check tc-toggle', title: 'Pin this note to the current playback time' }, tcBox, 'Pin to ', tcVal) : h('span');
    var form = h('form', { class: 'comment-form' }, ta, h('div', { class: 'form-row' }, left, btn));
    var touched = false;

    if (media) {
      var upd = function () { tcVal.textContent = fmtTime(media.currentTime); };
      var arm = function () { if (!touched) tcBox.checked = media.currentTime > 0; };
      media.addEventListener('timeupdate', upd);
      media.addEventListener('seeked', function () { upd(); arm(); });
      media.addEventListener('play', arm);
      media.addEventListener('pause', arm);
      tcBox.addEventListener('change', function () { touched = true; });
      if (isVideo) ta.addEventListener('focus', function () { if (!media.paused) media.pause(); });
    }

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); btn.click(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      var secs = media && tcBox.checked && !v.failed ? media.currentTime : null;
      btn.disabled = true;
      api.add({
        kind: 'comment', section: v.kind, itemId: v.cfg.id, itemTitle: titleOf(v),
        version: isVideo ? (v.cfg.version || '') : '', name: state.name,
        seconds: secs == null ? '' : Math.round(secs * 100) / 100, timecode: secs == null ? '' : timecode(secs),
        rating: '', comment: text
      }).then(function (item) {
        state.items.push(normalize(item));
        ta.value = '';
        touched = false;
        renderView(v, item.id);
        renderToc();
        renderStoryboardMeta();
        toast('Note posted');
      }, function (err) { toast(err.message, true); })
        .then(function () { btn.disabled = false; });
    });

    v.countEl = h('span');
    v.thread = h('ul', { class: 'thread' });
    return [form, h('div', { class: 'thread-head' }, v.countEl), v.thread];
  }

  /* ---------- storyboard: one frame grabbed from each clip ---------- */
  function clipViews() { return views.filter(function (v) { return v.kind === 'clip'; }); }

  function buildStoryboard() {
    var grid = $('#sb-grid');
    clipViews().forEach(function (v) {
      v.sbFrame = h('div', { class: 'sb-frame' }, h('span', { class: 'sb-wait', text: v.cfg.src ? 'Loading frame…' : 'Not posted yet' }));
      v.sbMeta = h('div', { class: 'sb-meta' });
      var a = h('a', { class: 'sb-card' + (v.cfg.src ? '' : ' sb-empty'), href: '#' + anchorOf(v), title: 'Go to clip ' + v.num },
        v.sbFrame,
        h('div', { class: 'sb-cap' }, h('span', { class: 'sb-num', text: v.num }), h('span', { class: 'sb-title', text: v.cfg.title })),
        v.sbMeta);
      a.addEventListener('click', function (e) { e.preventDefault(); goToClip(v); });
      grid.append(a);
    });
    if (!CLIPS.length) $('#storyboard').hidden = true;
    renderStoryboardMeta();
    // grab frames one clip at a time so a slow connection isn't flooded
    clipViews().filter(function (v) { return v.cfg.src; }).reduce(function (p, v) {
      return p.then(function () { return captureFrame(v); });
    }, Promise.resolve());
  }

  function frameTimeFor(v, duration) {
    var at = v.cfg.frameAt;
    var t = at === '' || at == null || isNaN(at) ? duration * 0.5 : Number(at);
    return Math.min(Math.max(0, t), Math.max(0, duration - 0.05));
  }

  function captureFrame(v) {
    if (v.cfg.poster) {     // a still you exported yourself doubles as the storyboard frame
      var at = v.cfg.frameAt;
      v.frameAt = at === '' || at == null || isNaN(at) ? 0 : Number(at);
      v.sbFrame.replaceChildren(h('img', { src: v.cfg.poster, alt: 'Clip ' + v.num + ' storyboard frame', loading: 'lazy' }));
      return Promise.resolve();
    }
    if (v.vimeo) {
      v.sbFrame.replaceChildren(h('span', { class: 'sb-wait', text: 'Vimeo clip: set a poster image for its frame' }));
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var vid = document.createElement('video'), finished = false;
      vid.muted = true; vid.playsInline = true; vid.preload = 'auto';
      var timer = setTimeout(function () { finish(false); }, 20000);
      function finish(ok, why) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (!ok) v.sbFrame.replaceChildren(h('span', { class: 'sb-wait', text: why || 'Frame unavailable — open the clip' }));
        vid.removeAttribute('src'); vid.load();
        resolve();
      }
      vid.addEventListener('error', function () { finish(false, 'File missing'); });
      vid.addEventListener('loadedmetadata', function () {
        v.frameAt = frameTimeFor(v, vid.duration || 0);
        vid.currentTime = v.frameAt;
      });
      vid.addEventListener('seeked', function () {
        var draw = function () {
          var c = document.createElement('canvas');
          c.width = 640; c.height = 360;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
          var vw = vid.videoWidth || 16, vh = vid.videoHeight || 9;
          var sc = Math.min(c.width / vw, c.height / vh), w = vw * sc, hh = vh * sc;
          try { ctx.drawImage(vid, (c.width - w) / 2, (c.height - hh) / 2, w, hh); } catch (e) { return finish(false); }
          c.setAttribute('role', 'img');
          c.setAttribute('aria-label', 'Clip ' + v.num + ' frame at ' + fmtTime(v.frameAt));
          v.sbFrame.replaceChildren(c, h('span', { class: 'sb-tc', text: fmtTime(v.frameAt) }));
          // reuse the grab as the clip's cover image, so the player doesn't open on a black first frame
          if (v.media && !v.cfg.poster) { try { v.media.poster = c.toDataURL('image/jpeg', 0.85); } catch (e) {} }
          finish(true);
        };
        if (vid.readyState >= 2) draw(); else vid.addEventListener('loadeddata', draw, { once: true });
      });
      vid.src = v.cfg.src;
    });
  }

  function renderStoryboardMeta() {
    var cv = clipViews();
    if (!cv.length || !cv[0].sbMeta) return;
    var total = 0, posted = 0;
    cv.forEach(function (v) {
      if (v.cfg.src && !v.failed) posted++;
      if (v.duration && !v.failed) total += v.duration;
      var n = commentsFor(v).length;
      var bits = [];
      if (!v.cfg.src) bits.push('Not posted yet');
      else if (v.failed) bits.push('File missing');
      else if (v.duration) bits.push(fmtTime(v.duration));
      if (v.cfg.version && v.cfg.src) bits.push(v.cfg.version);
      bits.push(n === 1 ? '1 note' : n + ' notes');
      v.sbMeta.textContent = bits.join(' · ');
    });
    $('#sb-summary').textContent = cv.length + ' clips · ' + posted + ' posted' + (total ? ' · ' + fmtTime(total) + ' running time so far' : '');
  }

  function goToClip(v) {
    var card = document.getElementById(anchorOf(v));
    if (!card) return;
    history.replaceState(null, '', '#' + anchorOf(v));
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.remove('card-flash'); void card.offsetWidth; card.classList.add('card-flash');
    if (v.media && !v.failed && v.frameAt != null) { v.media.currentTime = v.frameAt; v.media.pause(); }
  }

  function buildToc() {
    var to = $('#toc-overview'), tc = $('#toc-clips'), tm = $('#toc-music');
    var entries = [];
    if (CLIPS.length) entries.push({ list: to, href: '#storyboard', n: '▦', t: 'Storyboard' });
    views.forEach(function (v) {
      if (v.kind === 'full' && !v.latest) return;
      v.tocCount = h('span', { class: v.kind === 'music' ? 'avg' : 'c zero' });
      entries.push({ list: v.kind === 'full' ? to : v.kind === 'clip' ? tc : tm, href: v.kind === 'full' ? '#fullcut' : '#' + anchorOf(v),
        n: v.kind === 'full' ? '▶' : v.num, t: v.kind === 'full' ? 'Full cut' : v.cfg.title, count: v.tocCount, view: v });
    });
    entries.forEach(function (en) {
      var a = h('a', { href: en.href }, h('span', { class: 'n', text: en.n }), h('span', { class: 't', text: en.t }), en.count || null);
      if (en.view) en.view.tocLink = a;
      en.list.append(h('li', null, a));
    });
    $('#toc-overview-group').hidden = !to.children.length;
    $('#toc-music-group').hidden = !tm.children.length;
    if ('IntersectionObserver' in window) {
      var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
      var io = new IntersectionObserver(function (list) {
        list.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      links.forEach(function (a) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) io.observe(t); });
    }
  }

  /* ---------- rendering ---------- */
  function commentsFor(v) {
    return state.items.filter(function (x) { return x.kind === 'comment' && x.itemId === v.cfg.id; });
  }
  function isOld(x, v) { return v.kind === 'clip' && x.version && v.cfg.version && x.version !== v.cfg.version; }

  function renderAll() {
    views.forEach(function (v) { renderView(v); });
    renderToc();
    renderRanking();
    renderStoryboardMeta();
  }

  function renderView(v, flashId) {
    var all = commentsFor(v);
    var list = all.filter(function (x) { return state.showOlder || !isOld(x, v); });
    list.sort(function (a, b) {
      if (state.sort === 'timecode') {
        var as = a.seconds == null ? Infinity : a.seconds, bs = b.seconds == null ? Infinity : b.seconds;
        if (as !== bs) return as - bs;
        return String(a.created).localeCompare(String(b.created));
      }
      return String(b.created).localeCompare(String(a.created));
    });
    var hiddenOld = all.length - list.length;
    v.countEl.textContent = (all.length === 1 ? '1 note' : all.length + ' notes') + (hiddenOld ? ' (' + hiddenOld + ' on earlier drafts hidden)' : '');
    var top = v.thread.scrollTop;
    v.thread.replaceChildren();
    if (!list.length) v.thread.append(h('li', { class: 'thread-empty', text: v.kind === 'music' ? 'No notes yet.' : 'No notes yet. Pause on a moment and add the first one.' }));
    list.forEach(function (x) { v.thread.append(commentEl(x, v)); });
    v.thread.scrollTop = top;
    if (flashId) {
      var li = v.thread.querySelector('[data-id="' + flashId + '"]');
      if (li) { li.classList.add('flash'); li.scrollIntoView({ block: 'nearest' }); }
    }
    if (v.kind === 'music') renderRating(v);
    else renderMarkers(v);
  }

  function commentEl(x, v) {
    var old = isOld(x, v), done = !!x.status;
    var av = h('span', { class: 'avatar', text: initials(x.name) });
    av.style.background = colorFor(x.name);
    var body = h('div', { class: 'c-body' });
    if (x.seconds != null) {
      body.append(h('button', { class: 'tc-chip', type: 'button', title: 'Jump to ' + (x.timecode || fmtTime(x.seconds)),
        text: fmtTime(x.seconds), onclick: function () { seek(v, x.seconds, old && x.version); } }));
    }
    body.append(x.comment);
    var foot = h('div', { class: 'c-foot' },
      old ? h('span', { class: 'chip', text: 'on ' + x.version }) : null,
      done ? h('span', { class: 'chip done-chip', text: '✓ ' + x.status }) : null,
      v.kind !== 'music' ? h('button', { class: 'linkish', type: 'button', text: done ? 'Reopen' : 'Mark addressed', onclick: function () { toggleStatus(x, v); } }) : null);
    return h('li', { class: 'comment' + (old ? ' old' : '') + (done ? ' done' : ''), 'data-id': x.id },
      h('div', { class: 'c-head' }, av, h('b', { text: x.name || 'Anonymous' }), h('time', { datetime: x.created, title: fullDate(x.created), text: relTime(x.created) })),
      body, foot.childNodes.length ? foot : null);
  }

  function renderMarkers(v) {
    if (!v.markers) return;
    v.markers.querySelectorAll('.marker').forEach(function (m) { m.remove(); });
    if (!v.duration || !isFinite(v.duration)) return;
    commentsFor(v).forEach(function (x) {
      if (x.seconds == null) return;
      var old = isOld(x, v);
      if (old && !state.showOlder) return;
      var snippet = x.comment.length > 80 ? x.comment.slice(0, 80) + '…' : x.comment;
      var m = h('button', { type: 'button', class: 'marker' + (x.status ? ' done' : '') + (old ? ' old' : ''),
        title: fmtTime(x.seconds) + ' · ' + x.name + ': ' + snippet, 'aria-label': 'Note at ' + fmtTime(x.seconds) });
      m.style.left = Math.min(100, Math.max(0, x.seconds / v.duration * 100)) + '%';
      m.addEventListener('click', function (e) {
        e.stopPropagation();
        seek(v, x.seconds, old && x.version);
        var li = v.thread.querySelector('[data-id="' + x.id + '"]');
        if (li) { li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      });
      v.markers.append(m);
    });
  }

  function latestRatings(id) {
    var map = {};
    state.items.forEach(function (x) {
      if (x.kind !== 'rating' || x.itemId !== id || !x.rating) return;
      var k = nameKey(x.name);
      if (!map[k] || String(x.created) >= String(map[k].created)) map[k] = x;
    });
    return map;
  }
  function avgOf(map) {
    var vals = Object.keys(map).map(function (k) { return map[k].rating; });
    return { n: vals.length, avg: vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0 };
  }

  function renderRating(v) {
    var map = latestRatings(v.cfg.id), st = avgOf(map);
    v.avgEl.replaceChildren(
      st.n ? h('div', { class: 'big' }, h('span', { class: 'star', text: '★ ' }), st.avg.toFixed(1)) : h('div', { class: 'big', text: '—' }),
      h('small', { text: st.n ? st.n + (st.n === 1 ? ' rating' : ' ratings') : 'No ratings yet' }));
    var mine = map[nameKey(state.name)];
    var r = mine ? mine.rating : 0;
    Array.prototype.forEach.call(v.stars.children, function (b, i) {
      b.classList.toggle('on', i < r);
      b.setAttribute('aria-checked', String(i + 1 === r));
    });
    v.rateStatus.textContent = r ? 'You gave it ' + r + ' / 5' : 'Click a star to rate';
    var others = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.rating - a.rating || a.name.localeCompare(b.name); })
      .map(function (x) { return x.name + ' ' + x.rating + '★'; });
    v.ratersEl.textContent = others.length ? 'Ratings: ' + others.join(' · ') : '';
  }

  function renderRanking() {
    var box = $('#music-ranking');
    var rows = views.filter(function (v) { return v.kind === 'music'; })
      .map(function (v) { var s = avgOf(latestRatings(v.cfg.id)); return { v: v, n: s.n, avg: s.avg }; })
      .filter(function (r) { return r.n; })
      .sort(function (a, b) { return b.avg - a.avg || b.n - a.n; });
    box.hidden = rows.length < 1;
    box.replaceChildren(h('span', { class: 'lbl', text: 'Team ranking' }));
    rows.forEach(function (r, i) {
      box.append(h('a', { class: 'rank-item' + (i === 0 ? ' top' : ''), href: '#' + anchorOf(r.v) },
        h('b', { text: (i + 1) + '.' }), r.v.num + ' · ' + r.v.cfg.title, h('span', { text: ' ★ ' + r.avg.toFixed(1) + ' (' + r.n + ')' })));
    });
  }

  function renderToc() {
    views.forEach(function (v) {
      if (!v.tocCount) return;
      if (v.kind === 'music') {
        var s = avgOf(latestRatings(v.cfg.id));
        v.tocCount.textContent = s.n ? '★ ' + s.avg.toFixed(1) : '';
      } else {
        var n = commentsFor(v).length;
        v.tocCount.textContent = n || '';
        v.tocCount.className = 'c' + (n ? '' : ' zero');
        v.tocCount.title = n + (n === 1 ? ' note' : ' notes');
      }
    });
  }

  /* ---------- actions ---------- */
  function seek(v, t, oldVersion) {
    var m = v.media;
    if (!m || v.failed) return;
    var holder = m.closest('details');
    if (holder && !holder.open) holder.open = true;
    m.currentTime = t;
    if (m.tagName === 'VIDEO') m.pause(); else m.play().catch(function () {});
    var r = m.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (oldVersion) toast('This note was left on ' + oldVersion + ', so the moment may have shifted in ' + v.cfg.version + '.');
  }

  function playNextClip(v) {
    var i = views.indexOf(v);
    for (var j = i + 1; j < views.length; j++) {
      var n = views[j];
      if (n.kind === 'clip' && n.media && !n.failed) {
        n.media.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
        n.media.currentTime = 0;
        n.media.play().catch(function () {});
        return;
      }
    }
  }

  function toggleStatus(x, v) {
    var next = x.status ? '' : 'Addressed';
    var prev = x.status;
    x.status = next; renderView(v); // optimistic
    api.setStatus(x.id, next).then(function () {
      toast(next ? 'Marked addressed' : 'Reopened');
    }, function (err) {
      x.status = prev; renderView(v); toast(err.message, true);
    });
  }

  function rate(v, stars) {
    var temp = normalize({ id: 'tmp-' + uid(), created: new Date().toISOString(), kind: 'rating', itemId: v.cfg.id, name: state.name, rating: stars });
    state.items.push(temp);
    renderView(v); renderToc(); renderRanking();
    v.rateStatus.textContent = 'Saving…';
    api.add({ kind: 'rating', section: 'music', itemId: v.cfg.id, itemTitle: titleOf(v), version: '', name: state.name,
      seconds: '', timecode: '', rating: stars, comment: '' })
      .then(function (item) {
        var i = state.items.indexOf(temp);
        if (i >= 0) state.items[i] = normalize(item);
        renderView(v); renderToc(); renderRanking();
        toast('Rating saved');
      }, function (err) {
        state.items = state.items.filter(function (x) { return x !== temp; });
        renderView(v); renderToc(); renderRanking();
        toast(err.message, true);
      });
  }

  function refresh(quiet) {
    if (state.busy) return Promise.resolve();
    state.busy = true;
    var sync = $('#sync-status');
    sync.textContent = 'Syncing…';
    return api.list().then(function (items) {
      state.items = (items || []).map(normalize);
      state.lastSync = Date.now();
      renderAll();
      sync.textContent = REMOTE ? 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Saved in this browser only';
    }, function (err) {
      sync.textContent = "Couldn't load feedback";
      if (!quiet || err.code === 'auth') toast(err.message, true);
      if (!state.lastSync) renderAll();
    }).then(function () { state.busy = false; });
  }

  /* ---------- music audition: picture (muted) + track ---------- */
  var aud = { audio: new Audio(), options: [], seq: [], idx: 0, offset: 0, single: false, track: null, pic: null, vimeoPic: null };

  function initAudition() {
    var modal = $('#audition'), vid = $('#aud-video'), sel = $('#aud-start');
    vid.muted = true;
    aud.audio.preload = 'auto';
    aud.pic = vid;
    bindPicture(vid);
    sel.addEventListener('change', function () { startAudition(+sel.value, true); });
    $('#aud-close').addEventListener('click', closeAudition);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeAudition(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeAudition(); });
  }

  // Keep the track locked to whichever picture is showing (file video or Vimeo).
  function bindPicture(pic) {
    var live = function () { return aud.pic === pic; };
    function sync() {
      var t = aud.offset + pic.currentTime;
      if (aud.audio.duration && t > aud.audio.duration) { aud.audio.pause(); return; }
      if (Math.abs(aud.audio.currentTime - t) > 0.12) aud.audio.currentTime = t;
    }
    pic.addEventListener('playing', function () { if (!live()) return; sync(); aud.audio.play().catch(function () {}); });
    pic.addEventListener('pause', function () { if (live()) aud.audio.pause(); });
    pic.addEventListener('waiting', function () { if (live()) aud.audio.pause(); });
    pic.addEventListener('seeked', function () { if (live()) sync(); });
    pic.addEventListener('timeupdate', function () {
      if (live() && !pic.paused && Math.abs(aud.audio.currentTime - (aud.offset + pic.currentTime)) > 0.3) sync();
    });
    pic.addEventListener('ended', function () {
      if (!live() || pic.isVimeo) return;
      if (!aud.single && $('#aud-continue').checked && aud.idx < aud.seq.length - 1) {
        aud.offset += pic.duration || 0;
        aud.idx++;
        pic.src = aud.seq[aud.idx].cfg.src;
        pic.play().catch(function () {});
      }
    });
  }

  function openAudition(v) {
    pauseAllMedia(null);
    aud.track = v;
    aud.audio.src = v.cfg.src;
    var playable = function (x) { return x.media && !x.failed; };
    var clips = views.filter(function (x) { return x.kind === 'clip' && playable(x) && !x.vimeo; });
    aud.options = [];
    views.filter(function (x) { return x.kind === 'full' && playable(x); }).forEach(function (f) {
      aud.options.push({ label: 'Full cut · ' + (f.cfg.version || f.cfg.title) + ' (its own sound muted)', seq: [f], start: 0, single: true });
    });
    clips.forEach(function (c, i) { aud.options.push({ label: 'Clip ' + c.num + ' · ' + c.cfg.title, seq: clips, start: i, single: false }); });
    var sel = $('#aud-start');
    sel.replaceChildren();
    aud.options.forEach(function (o, i) { sel.append(h('option', { value: String(i), text: o.label })); });
    $('#aud-title').textContent = 'Try with the video — ' + v.num + ' · ' + v.cfg.title;
    $('#audition').hidden = false;
    startAudition(0, false);
    $('#aud-close').focus();
  }

  function startAudition(k, autoplay) {
    var vid = $('#aud-video'), o = aud.options[k];
    if (!o) return;
    aud.seq = o.seq; aud.idx = o.start; aud.single = o.single;
    $('#aud-continue-wrap').hidden = o.single;
    // the music starts where this picture would sit in the finished cut
    aud.offset = 0;
    if (!o.single) {
      for (var j = 0; j < views.length && views[j] !== o.seq[o.start]; j++) {
        if (views[j].kind === 'clip' && views[j].duration && !views[j].failed) aud.offset += views[j].duration;
      }
    }
    aud.audio.pause();
    try { aud.audio.currentTime = aud.offset; } catch (e) {}
    if (aud.vimeoPic) { aud.vimeoPic.destroy(); aud.vimeoPic = null; }
    var first = o.seq[o.start];
    if (first.vimeo) {
      vid.pause(); vid.removeAttribute('src'); vid.load(); vid.hidden = true;
      var vp = aud.vimeoPic = new VimeoMedia(parseVimeo(first.cfg.src), { muted: true, title: 'Picture only (muted)' });
      vid.parentNode.appendChild(vp.el);
      aud.pic = vp;
      bindPicture(vp);
      if (autoplay) vp.addEventListener('loadedmetadata', function () { vp.play().catch(function () {}); });
    } else {
      vid.hidden = false;
      aud.pic = vid;
      vid.src = first.cfg.src;
      if (autoplay) vid.play().catch(function () {});
    }
  }

  function closeAudition() {
    var vid = $('#aud-video');
    vid.pause(); aud.audio.pause();
    vid.removeAttribute('src'); vid.load(); vid.hidden = false;
    if (aud.vimeoPic) { aud.vimeoPic.destroy(); aud.vimeoPic = null; }
    aud.pic = vid;
    $('#audition').hidden = true;
    if (aud.track && aud.track.tryBtn) aud.track.tryBtn.focus();
  }

  initGate();
})();
