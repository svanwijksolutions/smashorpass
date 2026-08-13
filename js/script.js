/* ============================================================
   SmashorPass Novalja, site script
   - injects header/footer
   - client side language switching (6 languages, English fallback)
   - mobile menu, language dropdown, header shrink, cookie notice
   - safe scroll reveal (never hides content permanently)
   ============================================================ */
(function () {
  'use strict';

  var LANGS = ['hr', 'en', 'it', 'de', 'es', 'nl'];
  var NAMES = { hr: 'Hrvatski', en: 'English', it: 'Italiano', de: 'Deutsch', es: 'Español', nl: 'Nederlands' };
  var FALLBACK = 'en';
  var KEY_LANG = 'sop-lang';
  var KEY_NOTICE = 'sop-notice';

  /* -----------------------------------------------------------------
     Ordering destination.
     For now "Order here" opens the existing WhatsApp order chat.
     NEXT ROUND: replace this single value with the real ordering /
     payment service URL and every [data-order-link] button follows.
     ----------------------------------------------------------------- */
  var ORDER_URL = 'https://wa.me/385913609999?text=Hi%21%20I%27d%20like%20to%20order%20%F0%9F%8D%94';

  var dict = {};
  var base = {};
  var current = FALLBACK;

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* private mode, storage disabled */ }
    return null;
  }

  function t(key) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    if (Object.prototype.hasOwnProperty.call(base, key)) return base[key];
    return '';
  }

  /* ---------- language detection ---------- */
  function normalise(code) {
    if (!code) return null;
    var short = String(code).toLowerCase().split('-')[0];
    return LANGS.indexOf(short) > -1 ? short : null;
  }

  function detectLang() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = normalise(params.get('lang'));
    if (fromUrl) return fromUrl;

    var saved = normalise(store(KEY_LANG));
    if (saved) return saved;

    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage];
    for (var i = 0; i < list.length; i++) {
      var hit = normalise(list[i]);
      if (hit) return hit;
    }
    return FALLBACK;
  }

  /* ---------- applying translations ---------- */
  function applyDict() {
    document.documentElement.setAttribute('lang', current);

    $$('[data-i18n]').forEach(function (el) {
      var value = t(el.getAttribute('data-i18n'));
      if (value) el.textContent = value;
    });

    $$('[data-i18n-html]').forEach(function (el) {
      var value = t(el.getAttribute('data-i18n-html'));
      if (value) el.innerHTML = value;
    });

    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split('|').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length < 2) return;
        var value = t(bits[1].trim());
        if (value) el.setAttribute(bits[0].trim(), value);
      });
    });

    var page = document.body.getAttribute('data-page');
    if (page) {
      var title = t('meta.' + page + '.title');
      var desc = t('meta.' + page + '.desc');
      if (title) document.title = title;
      if (desc) {
        var metaDesc = $('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', desc);
        var ogDesc = $('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', desc);
      }
      if (title) {
        var ogTitle = $('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', title);
      }
    }

    var label = $('#langLabel');
    if (label) label.textContent = NAMES[current] || current.toUpperCase();
    var flagUse = $('#langFlagUse');
    if (flagUse) {
      flagUse.setAttribute('href', '#flag-' + current);
      flagUse.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#flag-' + current);
    }
    $$('.lang-option').forEach(function (btn) {
      btn.setAttribute('aria-current', btn.getAttribute('data-lang') === current ? 'true' : 'false');
    });
  }

  function loadDict(code) {
    return fetch('i18n/' + code + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('missing ' + code);
        return r.json();
      });
  }

  function setLang(code, remember) {
    var target = normalise(code) || FALLBACK;
    return loadDict(target)
      .then(function (data) {
        dict = data;
        current = target;
        if (remember) store(KEY_LANG, target);
        applyDict();
      })
      .catch(function () {
        if (target !== FALLBACK) return setLang(FALLBACK, false);
        applyDict();
      });
  }

  function initI18n() {
    var wanted = detectLang();
    return loadDict(FALLBACK)
      .then(function (data) { base = data; })
      .catch(function () { base = {}; })
      .then(function () { return setLang(wanted, false); });
  }

  /* ---------- header / footer injection ---------- */
  function injectPart(placeholderId, url) {
    var holder = document.getElementById(placeholderId);
    if (!holder) return Promise.resolve();
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var tpl = document.createElement('template');
        tpl.innerHTML = html;
        holder.parentNode.replaceChild(tpl.content, holder);
      })
      .catch(function () { /* keep the page usable if a part fails */ });
  }

  /* ---------- navigation ---------- */
  function markCurrentPage() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var map = { 'index.html': 'home', '': 'home', 'menu.html': 'menu', 'contact.html': 'contact' };
    var key = map[path];
    if (!key) return;
    $$('.nav-link[data-nav]').forEach(function (link) {
      if (link.getAttribute('data-nav') === key) link.setAttribute('aria-current', 'page');
    });
  }

  function initMenu() {
    var toggle = $('#navToggle');
    var nav = $('#mainNav');
    if (!toggle || !nav) return;

    function close() {
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    function open() {
      document.body.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', function () {
      if (document.body.classList.contains('menu-open')) close(); else open();
    });

    nav.addEventListener('click', function (ev) {
      if (ev.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && document.body.classList.contains('menu-open')) {
        close();
        toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) close();
    });
  }

  function initLangSwitcher() {
    var wrap = $('#langWrap');
    var btn = $('#langBtn');

    if (wrap && btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = wrap.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (ev) {
        if (!wrap.contains(ev.target)) {
          wrap.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && wrap.classList.contains('open')) {
          wrap.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    }

    $$('.lang-option').forEach(function (option) {
      option.addEventListener('click', function () {
        setLang(option.getAttribute('data-lang'), true);
        if (wrap) {
          wrap.classList.remove('open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* ---------- order buttons (single central destination) ---------- */
  function initOrderLinks() {
    $$('[data-order-link]').forEach(function (a) {
      a.setAttribute('href', ORDER_URL);
    });
  }

  /* ---------- subtle scroll parallax (transform only) ---------- */
  function initParallax() {
    var els = $$('[data-parallax]');
    if (!els.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var ticking = false;
    function update() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var centre = r.top + r.height / 2;
        var ratio = (centre - vh / 2) / vh;
        ratio = Math.max(-1, Math.min(1, ratio));
        el.style.transform = 'translate3d(0,' + (ratio * -24).toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  function initHeaderScroll() {
    var header = $('#siteHeader');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('scrolled', window.scrollY > 20);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------- cookie notice ---------- */
  function initCookie() {
    var bar = $('#cookieBar');
    var ok = $('#cookieOk');
    if (!bar || !ok) return;
    if (store(KEY_NOTICE) === 'ok') return;

    bar.classList.add('show');
    document.body.classList.add('cookie-open');
    ok.addEventListener('click', function () {
      bar.classList.remove('show');
      document.body.classList.remove('cookie-open');
      store(KEY_NOTICE, 'ok');
    });
  }

  /* ---------- footer year ---------- */
  function initYear() {
    var el = $('#year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------- safe scroll reveal ---------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) return;

    document.body.classList.add('js-motion');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (item) { observer.observe(item); });

    /* safety net: nothing may stay invisible */
    window.setTimeout(function () {
      $$('.reveal').forEach(function (item) { item.classList.add('in-view'); });
    }, 2400);
  }

  /* ---------- boot ---------- */
  function boot() {
    Promise.all([
      injectPart('header-placeholder', 'components/header.html'),
      injectPart('footer-placeholder', 'components/footer.html')
    ]).then(function () {
      markCurrentPage();
      initMenu();
      initLangSwitcher();
      initOrderLinks();
      initHeaderScroll();
      initCookie();
      initYear();
      initReveal();
      initParallax();
      return initI18n();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
