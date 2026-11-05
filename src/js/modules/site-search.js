/**
 * 站内搜索弹层（主题自带，替代 PluginSearchWidget 的界面）。
 *
 * 数据走 Halo 核心的索引检索接口，返回体里除了标题和摘要，还有 type、发布时间、
 * permalink，所以分组和日期柱都能在前端直接排。索引只有 post/page，成员与友情链接
 * 由服务端渲染成隐藏节点本地匹配；署名索引里没有（ownerName 是登录名），同样从
 * 服务端的 [data-ns-authors] 池按文章 ID 取，与归档页同一条回落链。
 *
 * 接口对高亮词的处理是「把你传的标签名原样包上」，因此先把除 mark 以外的标签剥掉、
 * 整体转义、再把 &lt;mark&gt; 还原，注入的一律是纯文本加 mark。
 */
import { t } from './i18n.js';

var ENDPOINT = '/apis/api.halo.run/v1alpha1/indices/-/search';
var HISTORY_KEY = 'nucma.search.history';
var HISTORY_MAX = 8;
var LIMIT = 20;
var DEBOUNCE = 220;
var MIN_KEYWORD = 1;

/* 第 6 套「筛选条」：分组顺序按用户定的 文章 → 页面 → 成员 → 友情链接，
   row = 日期柱+标题+署名节选的行，card = 站点同款卡片。 */
var GROUP_DEFS = [
  { key: 'post', type: 'post.content.halo.run', shape: 'row', label: function () { return t('search.groupPost'); } },
  { key: 'page', type: 'page.content.halo.run', shape: 'row', label: function () { return t('search.groupPage'); } },
  { key: 'member', local: 'member', shape: 'card', label: function () { return t('search.groupMember'); } },
  { key: 'link', local: 'link', shape: 'card', label: function () { return t('search.groupLink'); } }
];

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlight(value) {
  return esc(value)
    .replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
}

/** 本地池（成员/链接）不经过索引接口，命中位置自己找，逐段转义后再包 mark。 */
function mark(value, keyword) {
  var text = String(value == null ? '' : value);
  var needle = String(keyword || '').toLowerCase();
  if (!needle) return esc(text);
  var out = '';
  var from = 0;
  for (;;) {
    var at = text.toLowerCase().indexOf(needle, from);
    if (at < 0) break;
    out += esc(text.slice(from, at)) + '<mark>' + esc(text.slice(at, at + needle.length)) + '</mark>';
    from = at + needle.length;
  }
  return out + esc(text.slice(from));
}

function hostOf(url) {
  return String(url || '').replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split('/')[0];
}

/** 卡片没有头像/logo 时用首字占位，取法按码点，避免生僻字被切成半个代理对。 */
function firstChar(text) {
  var chars = Array.from(String(text || '').trim());
  return chars.length ? chars[0] : '?';
}

/** 摘要优先用 description；缺了就从正文剥标签取一段。 */
function excerpt(hit) {
  var raw = hit.description || hit.content || '';
  if (!hit.description) raw = String(raw).replace(/<(?!\/?mark>)[^>]*>/g, ' ');
  raw = String(raw).replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return highlight(raw.length > 132 ? raw.slice(0, 132) + '…' : raw);
}

/** 日期柱拆成「年份小字 + MM-DD 块」，和归档页的左列一个结构。 */
function dateParts(iso) {
  if (!iso) return { y: '', md: '' };
  var d = new Date(iso);
  if (isNaN(d.getTime())) return { y: '', md: '' };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return { y: String(d.getFullYear()), md: pad(d.getMonth() + 1) + '-' + pad(d.getDate()) };
}

function readHistory() {
  try {
    var list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(list) ? list.filter(function (x) { return typeof x === 'string' && x; }) : [];
  } catch (e) {
    return [];
  }
}

function writeHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch (e) {
    // 隐私模式下 localStorage 会抛，忽略即可
  }
}

export function initSiteSearch() {
  var root = document.getElementById('nucma-search');
  if (!root || root.dataset.nucmaSearch === 'true') return;
  root.dataset.nucmaSearch = 'true';

  var input = root.querySelector('#ns-input');
  var panel = root.querySelector('.ns__panel');
  var listEl = root.querySelector('[data-ns-list]');
  var hintEl = root.querySelector('[data-ns-hint]');
  var stateEl = root.querySelector('[data-ns-state]');
  var stateMain = root.querySelector('[data-ns-state-main]');
  var stateSub = root.querySelector('[data-ns-state-sub]');
  var recentEl = root.querySelector('[data-ns-recent]');
  var recentList = root.querySelector('[data-ns-recent-list]');
  var clearBtn = root.querySelector('[data-ns-clear]');
  var countEl = root.querySelector('[data-ns-count]');
  var chipsEl = root.querySelector('[data-ns-chips]');
  var chipsList = root.querySelector('[data-ns-chips-list]');
  var timeEl = root.querySelector('[data-ns-time]');

  // 成员与链接由服务端渲染成隐藏节点（插件数据不在核心索引里，公开 REST 要登录）。
  var pool = { member: [], link: [] };
  Array.prototype.forEach.call(document.querySelectorAll('[data-ns-extra] [data-ns-kind]'), function (el) {
    var kind = el.getAttribute('data-ns-kind');
    if (!pool[kind]) return;
    pool[kind].push({
      name: el.getAttribute('data-name') || '',
      desc: el.getAttribute('data-desc') || '',
      group: el.getAttribute('data-group') || '',
      school: el.getAttribute('data-school') || '',
      avatar: el.getAttribute('data-avatar') || '',
      logo: el.getAttribute('data-logo') || '',
      url: el.getAttribute('data-url') || ''
    });
  });

  // 文章/页面的署名同样靠服务端隐藏节点（索引接口只有登录名）。
  var authorMap = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-ns-authors] [data-id]'), function (el) {
    var name = el.getAttribute('data-author') || '';
    if (name) authorMap[el.getAttribute('data-id')] = name;
  });

  var items = [];
  var sel = -1;
  var seq = 0;
  var timer = 0;
  var lastOpener = null;
  var groups = [];      // 当次结果按组分好，chips 只切视图不重查
  var filter = '';
  var lastKeyword = '';

  function show(el, on) { el.hidden = !on; }

  function hideChips() {
    show(chipsEl, false);
    chipsList.innerHTML = '';
  }

  function setIdle() {
    items = [];
    sel = -1;
    groups = [];
    filter = '';
    panel.classList.remove('is-loading');
    listEl.innerHTML = '';
    hideChips();
    show(stateEl, false);
    show(hintEl, !input.value.trim());
    var history = readHistory();
    show(recentEl, history.length > 0);
    recentList.innerHTML = history.map(function (kw) {
      return '<button type="button" class="ns__recentItem" data-ns-kw="' + esc(kw) + '">' + esc(kw) + '</button>';
    }).join('');
    countEl.textContent = '';
  }

  function setState(main, sub) {
    items = [];
    sel = -1;
    groups = [];
    filter = '';
    panel.classList.remove('is-loading');
    listEl.innerHTML = '';
    hideChips();
    show(hintEl, false);
    show(recentEl, false);
    stateMain.textContent = main;
    stateSub.textContent = sub || '';
    show(stateSub, !!sub);
    show(stateEl, true);
    countEl.textContent = '';
  }

  /** 文章/页面的行：日期柱 + 标题；第二行「文 / 署名 · 节选」只在节选真带划线时出现。 */
  function rowHtml(hit, index) {
    var d = dateParts(hit.creationTimestamp);
    var text = excerpt(hit);
    var author = authorMap[hit.metadataName] || '';
    var byline = text.indexOf('<mark>') >= 0
      ? '<span class="ns__byline">' +
      (author ? '<em>' + esc(t('post.bylinePrefix')) + '</em><b>' + esc(author) + '</b>' : '') +
      '<i>' + text + '</i></span>'
      : '';
    return '<a class="ns__row" role="listitem" href="' + esc(hit.permalink || '#') + '" data-i="' + index + '">' +
      '<span class="ns__dayCol">' +
      (d.y ? '<span class="ns__year">' + d.y + '</span>' : '') +
      '<span class="ns__day">' + esc(d.md) + '</span></span>' +
      '<span class="ns__main">' +
      '<span class="ns__title">' + highlight(hit.title) + '</span>' +
      byline +
      '</span></a>';
  }

  /** 成员/链接的卡片：和成员页、友链页同款（48 方图 + 名称 + 副行），选中态用卡片自己的 3px 朱红左条。 */
  function cardHtml(hit, index, keyword) {
    var isLink = hit.kind === 'link';
    var media = isLink ? hit.logo : hit.avatar;
    var sub;
    var attrs = '';
    if (isLink) {
      sub = [hostOf(hit.permalink), hit.description].filter(Boolean).join(' · ');
      attrs = ' target="_blank" rel="noopener noreferrer"';
    } else {
      sub = [hit.school, hit.group].filter(Boolean).join(' · ');
    }
    return '<a class="ns__card" role="listitem" href="' + esc(hit.permalink || '#') + '"' + attrs +
      ' data-i="' + index + '">' +
      '<span class="ns__logo">' +
      (media ? '<img src="' + esc(media) + '" alt="" loading="lazy" width="48" height="48">' : esc(firstChar(hit.title))) +
      '</span>' +
      '<span class="ns__cinfo">' +
      '<span class="ns__cname"><b>' + mark(hit.title, keyword) + '</b>' +
      (isLink ? '' : '<span class="ns__badge">' + esc(t('members.verified')) + '</span>') +
      '</span>' +
      (sub ? '<span class="ns__csub">' + mark(sub, keyword) + '</span>' : '') +
      '</span></a>';
  }

  function matchLocal(kind, keyword) {
    var needle = keyword.toLowerCase();
    var out = [];
    pool[kind].forEach(function (row) {
      if ((row.name + ' ' + row.desc + ' ' + row.group + ' ' + row.school).toLowerCase().indexOf(needle) < 0) return;
      out.push({
        local: true, kind: kind, title: row.name, description: row.desc,
        group: row.group, school: row.school, avatar: row.avatar, logo: row.logo,
        permalink: row.url
      });
    });
    return out;
  }

  function render(hits, millis, keyword) {
    panel.classList.remove('is-loading');
    show(hintEl, false);
    show(recentEl, false);
    show(stateEl, false);

    var buckets = [];
    // 顺序按用户定的：文章 → 页面 → 成员 → 友情链接（页面属正文，紧跟文章）
    GROUP_DEFS.forEach(function (def) {
      var bucket = def.local ? matchLocal(def.local, keyword)
        : hits.filter(function (h) { return h.type === def.type; });
      if (bucket.length) buckets.push({ key: def.key, label: def.label(), shape: def.shape, items: bucket });
    });

    groups = buckets;
    filter = '';
    lastKeyword = keyword;
    if (!buckets.length) {
      listEl.innerHTML = '';
      setState(t('search.noResults'), t('search.emptyHint'));
      return;
    }
    renderChips(millis);
    renderList();
  }

  function renderChips(millis) {
    var total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    var chips = [{ key: '', label: t('common.all'), n: total }].concat(groups.map(function (g) {
      return { key: g.key, label: g.label, n: g.items.length };
    }));
    chipsList.innerHTML = chips.map(function (c) {
      return '<button type="button" class="ns__chip" data-ns-filter="' + esc(c.key) + '">' +
        esc(c.label) + '<span class="ns__chipN">' + c.n + '</span></button>';
    }).join('');
    timeEl.textContent = millis + ' ms';
    show(chipsEl, true);
  }

  /** chips 只切视图：分组数据还在内存里，切换不再打接口。 */
  function renderList() {
    var shown = filter ? groups.filter(function (g) { return g.key === filter; }) : groups;
    var rows = [];
    var html = '';
    var index = 0;
    shown.forEach(function (g) {
      html += '<p class="ns__group"><span class="ns__groupDash" aria-hidden="true"></span>' +
        esc(g.label) + '<span class="ns__groupN">' + g.items.length + '</span></p>';
      if (g.shape === 'card') {
        html += '<div class="ns__cards">' + g.items.map(function (hit) {
          rows.push(hit);
          return cardHtml(hit, index++, lastKeyword);
        }).join('') + '</div>';
      } else {
        g.items.forEach(function (hit) {
          rows.push(hit);
          html += rowHtml(hit, index++);
        });
      }
    });
    items = rows;
    /* 新结果一律不带预选：只有真按过 ↑↓ 才出现高亮，鼠标没碰却有一行「被选中」是假信号 */
    sel = -1;
    listEl.innerHTML = html;
    countEl.textContent = t('search.hitsTotal', rows.length);
    paint();
  }

  function paint() {
    Array.prototype.forEach.call(chipsList.querySelectorAll('.ns__chip'), function (chip) {
      chip.classList.toggle('is-active', chip.getAttribute('data-ns-filter') === filter);
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-i]'), function (row) {
      var on = Number(row.getAttribute('data-i')) === sel;
      row.classList.toggle('is-selected', on);
      if (on) row.scrollIntoView({ block: 'nearest' });
    });
  }

  function search(keyword) {
    var token = ++seq;
    var started = Date.now();
    panel.classList.add('is-loading');
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: keyword,
        limit: LIMIT,
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>'
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (data) {
      if (token !== seq) return;
      render(data.hits || [], Date.now() - started, keyword);
    }).catch(function () {
      if (token !== seq) return;
      setState(t('search.error'), '');
    });
  }

  function onInput() {
    var keyword = input.value.trim();
    clearBtn.hidden = !keyword;
    window.clearTimeout(timer);
    if (keyword.length < MIN_KEYWORD) { setIdle(); return; }
    timer = window.setTimeout(function () { search(keyword); }, DEBOUNCE);
  }

  function remember(keyword) {
    if (!keyword) return;
    var history = readHistory().filter(function (x) { return x !== keyword; });
    history.unshift(keyword);
    writeHistory(history);
  }

  function open(opener) {
    lastOpener = opener || null;
    root.hidden = false;
    document.documentElement.classList.add('ns-open');
    // 重开时保留上一次的关键词并直接回到那份结果，只有空输入才显示提示/最近搜索。
    if (input.value.trim()) onInput(); else setIdle();
    window.setTimeout(function () { input.focus(); }, 30);
  }

  function close() {
    root.hidden = true;
    document.documentElement.classList.remove('ns-open');
    if (lastOpener) lastOpener.focus();
  }

  /* 键盘游标：sel = -1 表示「还没人用过上下键」，此时一行都不高亮。
     从这个起点出发，↓ 进第一条、↑ 进最后一条，之后按原逻辑循环。 */
  function move(step) {
    if (!items.length) return;
    sel = sel < 0
      ? (step > 0 ? 0 : items.length - 1)
      : (sel + step + items.length) % items.length;
    paint();
  }

  function activate() {
    var hit = items[sel];
    if (!hit) return;
    remember(input.value.trim());
    if (hit.local && hit.kind === 'link' && /^[a-z][a-z0-9+.-]*:\/\//i.test(hit.permalink)) {
      window.open(hit.permalink, '_blank', 'noopener');
      return;
    }
    window.location.href = hit.permalink;
  }

  root.addEventListener('click', function (event) {
    if (event.target.closest('[data-ns-close]')) { close(); return; }
    var chip = event.target.closest('[data-ns-filter]');
    if (chip) { filter = chip.getAttribute('data-ns-filter'); renderList(); input.focus(); return; }
    var kw = event.target.closest('[data-ns-kw]');
    if (kw) { input.value = kw.getAttribute('data-ns-kw'); onInput(); input.focus(); return; }
    if (event.target.closest('[data-ns-recent-clear]')) { writeHistory([]); setIdle(); return; }
    if (event.target.closest('[data-ns-clear]')) { input.value = ''; onInput(); input.focus(); return; }
    var row = event.target.closest('[data-i]');
    if (row) {
      event.preventDefault();
      sel = Number(row.getAttribute('data-i'));
      paint();
      activate();
    }
  });

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); if (sel >= 0) activate(); else if (input.value.trim()) search(input.value.trim()); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
  });

  document.addEventListener('keydown', function (event) {
    if (!root.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      return;
    }
    var isK = typeof event.key === 'string' && event.key.toLowerCase() === 'k';
    if ((event.metaKey || event.ctrlKey) && isK) {
      event.preventDefault();
      open(null);
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-search-open]'), function (button) {
    button.addEventListener('click', function () { open(button); });
  });
}
