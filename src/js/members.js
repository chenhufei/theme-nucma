/**
 * 成员页专用交互。较大的拼音与二维码依赖通过本地分包按需加载，
 * 避免成员页打开阶段等待外部 CDN，也避免增加全站主脚本体积。
 */
(function() {
  'use strict';

  var pinyinLoader = null;
  var qrLoader = null;

  function loadPinyin() {
    if (!pinyinLoader) {
      pinyinLoader = import('pinyin-pro').then(function(module) { return module.pinyin; });
    }
    return pinyinLoader;
  }

  function loadQrCode() {
    if (!qrLoader) {
      qrLoader = import('qrcode').then(function(module) { return module.default || module; });
    }
    return qrLoader;
  }

  function initMemberSearch() {
    var input = document.getElementById('memberSearchInput');
    if (!input) return;
    var cards = Array.from(document.querySelectorAll('.member-card'));
    var groups = Array.from(document.querySelectorAll('.member-group'));
    var groupCounts = Array.from(document.querySelectorAll('.member-group-count'));
    var searchEmpty = document.getElementById('memberSearchEmpty');
    var pinyinCache = new WeakMap();
    var searchTimer = null;
    var searchRevision = 0;

    function reset() {
      cards.forEach(function(card) { card.style.display = ''; });
      groups.forEach(function(group) { group.style.display = ''; });
      groupCounts.forEach(function(count) {
        if (count.dataset.total) count.textContent = count.dataset.total;
      });
      if (searchEmpty) searchEmpty.hidden = true;
    }

    function getPinyinInitials(card, pinyin) {
      if (pinyinCache.has(card)) return pinyinCache.get(card);
      var name = card.querySelector('.member-name')?.textContent || '';
      var school = card.querySelector('.member-school')?.textContent || '';
      var initials = [name, school].map(function(value) {
        return pinyin(value, { pattern: 'first', type: 'array' }).join('').toLowerCase();
      }).join(' ');
      pinyinCache.set(card, initials);
      return initials;
    }

    async function update() {
      var revision = ++searchRevision;
      var filter = input.value.toLowerCase().trim();
      if (!filter) {
        reset();
        return;
      }

      var pinyin = null;
      if (/^[a-z0-9]+$/i.test(filter)) {
        try { pinyin = await loadPinyin(); } catch (_) {}
        if (revision !== searchRevision || input.value.toLowerCase().trim() !== filter) return;
      }

      cards.forEach(function(card) {
        var name = card.querySelector('.member-name')?.textContent?.toLowerCase() || '';
        var school = card.querySelector('.member-school')?.textContent?.toLowerCase() || '';
        var qq = card.getAttribute('data-qq') || '';
        var matched = name.includes(filter) || school.includes(filter) || qq.includes(filter);
        if (!matched && pinyin) matched = getPinyinInitials(card, pinyin).includes(filter);
        card.style.display = matched ? '' : 'none';
      });

      groups.forEach(function(group) {
        var visibleCards = Array.from(group.querySelectorAll('.member-card')).filter(function(card) {
          return card.style.display !== 'none';
        });
        group.style.display = visibleCards.length ? '' : 'none';
        var count = group.querySelector('.member-group-count');
        if (count) count.textContent = String(visibleCards.length);
      });
      var matches = cards.filter(function(card) { return card.style.display !== 'none'; }).length;
      if (searchEmpty) searchEmpty.hidden = matches > 0;
    }

    input.addEventListener('input', function() {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(update, 120);
    });
  }

  function initMemberQrPopups() {
    var canvases = Array.from(document.querySelectorAll('[data-member-qr]'));
    if (!canvases.length) return;
    var desktopMedia = window.matchMedia('(min-width: 768px) and (hover: hover)');

    async function renderQr(canvas) {
      if (!desktopMedia.matches || !canvas || canvas.dataset.qrState) return;
      var text = canvas.dataset.qrText;
      var popup = canvas.closest('[data-member-qr-popup]');
      var status = popup?.querySelector('[data-member-qr-status]');
      if (!text || !popup) return;

      canvas.dataset.qrState = 'loading';
      popup.classList.add('is-loading');
      try {
        var QRCode = await loadQrCode();
        await QRCode.toCanvas(canvas, text, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827FF', light: '#FFFFFFFF' },
        });
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        canvas.dataset.qrState = 'ready';
        popup.classList.remove('is-loading', 'is-error');
        popup.classList.add('is-ready');
        if (status) status.textContent = '二维码已生成';
      } catch (_) {
        delete canvas.dataset.qrState;
        popup.classList.remove('is-loading', 'is-ready');
        popup.classList.add('is-error');
        if (status) status.textContent = '二维码生成失败';
      }
    }

    canvases.forEach(function(canvas) {
      var card = canvas.closest('.member-card');
      if (!card) return;
      card.addEventListener('pointerenter', function() { renderQr(canvas); }, { passive: true });
      card.addEventListener('focusin', function() { renderQr(canvas); });
    });
  }

  function init() {
    initMemberSearch();
    initMemberQrPopups();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
