/**
 * 友链页专用搜索。拼音能力仅在输入拉丁字母时按需加载，避免增加全站主包。
 */
(function() {
  'use strict';

  var pinyinLoader = null;

  function loadPinyin() {
    if (!pinyinLoader) {
      pinyinLoader = import('pinyin-pro').then(function(module) { return module.pinyin; });
    }
    return pinyinLoader;
  }

  function normalize(value) {
    var text = (value || '').toString().toLowerCase();
    try { text = text.normalize('NFKC'); } catch (_) {}
    return text.replace(/\s+/g, ' ').trim();
  }

  function initLinkSearch() {
    var search = document.querySelector('[data-link-search]');
    var input = document.getElementById('linkSearchInput');
    var clearButton = search?.querySelector('[data-link-search-clear]');
    var resultRoot = document.getElementById('linkSearchResults');
    var empty = document.getElementById('linkSearchEmpty');
    var count = document.getElementById('linkSearchCount');
    if (!search || !input || !clearButton || !resultRoot || !empty || !count) return;

    var cards = Array.from(resultRoot.querySelectorAll('.link-card'));
    if (!cards.length) {
      search.hidden = true;
      return;
    }

    var groups = Array.from(resultRoot.querySelectorAll('.link-group'));
    var pinyinCache = new WeakMap();
    var revision = 0;
    var timer = null;
    var indexedCards = cards.map(function(card) {
      return {
        card: card,
        name: normalize(card.querySelector('.link-name')?.textContent),
        text: normalize([
          card.querySelector('.link-name')?.textContent,
          card.querySelector('.link-desc')?.textContent,
          card.getAttribute('href'),
        ].filter(Boolean).join(' ')),
      };
    });

    function getPinyin(item, pinyin) {
      if (pinyinCache.has(item.card)) return pinyinCache.get(item.card);
      var full = normalize(pinyin(item.name, { toneType: 'none', type: 'array' }).join(''));
      var initials = normalize(pinyin(item.name, { pattern: 'first', type: 'array' }).join(''));
      var value = full + ' ' + initials;
      pinyinCache.set(item.card, value);
      return value;
    }

    function apply(query, pinyin) {
      var visible = 0;
      indexedCards.forEach(function(item) {
        var matched = !query || item.text.includes(query);
        if (!matched && pinyin) matched = getPinyin(item, pinyin).includes(query);
        item.card.hidden = !matched;
        if (matched) visible++;
      });
      groups.forEach(function(group) {
        var groupCards = Array.from(group.querySelectorAll('.link-card'));
        var groupVisible = groupCards.filter(function(card) { return !card.hidden; }).length;
        group.hidden = groupVisible === 0;
        var groupCount = group.querySelector('.link-group-count');
        if (groupCount) groupCount.textContent = String(groupVisible);
      });
      count.textContent = query ? visible + ' 个结果' : '共 ' + cards.length + ' 个';
      clearButton.hidden = !query;
      empty.hidden = !query || visible > 0;
    }

    async function update() {
      var currentRevision = ++revision;
      var query = normalize(input.value);
      if (!query || !/^[a-z0-9]+$/i.test(query)) {
        apply(query, null);
        return;
      }
      var pinyin = null;
      try { pinyin = await loadPinyin(); } catch (_) {}
      if (currentRevision !== revision || normalize(input.value) !== query) return;
      apply(query, pinyin);
    }

    function scheduleUpdate() {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 100);
    }

    function clear() {
      input.value = '';
      revision++;
      apply('', null);
      input.focus();
    }

    input.addEventListener('input', scheduleUpdate);
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        clear();
      }
    });
    clearButton.addEventListener('click', clear);
    apply('', null);
  }

  document.addEventListener('DOMContentLoaded', initLinkSearch);
})();
