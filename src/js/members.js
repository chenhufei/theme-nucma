/**
 * 成员页专用交互。较大的拼音与二维码依赖通过本地分包按需加载，
 * 避免成员页打开阶段等待外部 CDN，也避免增加全站主脚本体积。
 */
import { t } from './modules/i18n.js';
import { defaultQqAvatar } from './modules/avatar.js';
import { createMemberNetwork } from './modules/network.js';
import { normalizeQqLink, decodeQrFromFile } from './modules/qq-link.js';
import { renderBadgeShare } from './modules/badge-share.js';

(function() {
  'use strict';

  var pinyinLoader = null;
  var qrLoader = null;
  var chinaMapLoader = null;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var REVEAL_BATCH = 24;

  // i18n-ignore-start 省市/高校关键词是匹配词典，不是界面文案
  var REGION_RULES = [
    ['北京', ['北京', '海淀', '朝阳', '清华', '北大', '人大', '北航', '北理', '北师大', '中传', '中央财', '对外经贸']],
    ['天津', ['天津', '南开', '天大']],
    ['上海', ['上海', '复旦', '同济', '华东师范', '华东理工', '上外', '上财']],
    ['重庆', ['重庆']],
    ['河北', ['河北', '石家庄', '唐山', '保定', '秦皇岛', '燕山大学']],
    ['山西', ['山西', '太原', '晋中']],
    ['内蒙古', ['内蒙古', '呼和浩特', '包头']],
    ['辽宁', ['辽宁', '沈阳', '大连', '东北大学']],
    ['吉林', ['吉林', '长春', '延边']],
    ['黑龙江', ['黑龙江', '哈尔滨', '大庆']],
    ['江苏', ['江苏', '南京', '苏州', '无锡', '常州', '徐州', '扬州', '南通']],
    ['浙江', ['浙江', '杭州', '宁波', '温州', '金华', '绍兴', '嘉兴']],
    ['安徽', ['安徽', '合肥', '芜湖', '蚌埠']],
    ['福建', ['福建', '福州', '厦门', '泉州', '漳州']],
    ['江西', ['江西', '南昌', '赣州', '九江']],
    ['山东', ['山东', '济南', '青岛', '烟台', '威海', '潍坊', '临沂']],
    ['河南', ['河南', '郑州', '洛阳', '开封', '新乡']],
    ['湖北', ['湖北', '武汉', '宜昌', '襄阳']],
    ['湖南', ['湖南', '长沙', '湘潭', '株洲', '衡阳']],
    ['广东', ['广东', '广州', '深圳', '珠海', '佛山', '东莞', '中山', '汕头', '华南理工', '暨南']],
    ['广西', ['广西', '南宁', '桂林', '柳州']],
    ['海南', ['海南', '海口', '三亚']],
    ['四川', ['四川', '成都', '绵阳', '电子科技']],
    ['贵州', ['贵州', '贵阳', '遵义']],
    ['云南', ['云南', '昆明', '大理', '丽江']],
    ['西藏', ['西藏', '拉萨']],
    ['陕西', ['陕西', '西安', '咸阳', '西北工业']],
    ['甘肃', ['甘肃', '兰州']],
    ['青海', ['青海', '西宁']],
    ['宁夏', ['宁夏', '银川']],
    ['新疆', ['新疆', '乌鲁木齐', '石河子', '喀什']],
    ['香港', ['香港']],
    ['澳门', ['澳门']],
    ['台湾', ['台湾', '台北', '高雄']]
  ];
  // i18n-ignore-end

  /* 动态 import 的失败不能缓存：Promise 一旦 rejected 就会永久保持该状态，
     不清空模块变量的话，一次网络抖动或 chunk 404 之后，本次会话里拼音搜索 /
     二维码就再也不会成功，只能刷新页面。与 loadChinaProvinces 的写法保持一致。 */
  function loadPinyin() {
    if (!pinyinLoader) {
      pinyinLoader = import('pinyin-pro')
        .then(function(module) { return module.pinyin; })
        .catch(function(error) {
          pinyinLoader = null;
          throw error;
        });
    }
    return pinyinLoader;
  }

  function loadQrCode() {
    if (!qrLoader) {
      qrLoader = import('qrcode')
        .then(function(module) { return module.default || module; })
        .catch(function(error) {
          qrLoader = null;
          throw error;
        });
    }
    return qrLoader;
  }

  function loadChinaProvinces(url) {
    if (!chinaMapLoader) {
      chinaMapLoader = fetch(url, { credentials: 'same-origin' })
        .then(function(response) {
          if (!response.ok) throw new Error(t('members.mapLoadFailed', response.status));
          return response.json();
        })
        .catch(function(error) {
          chinaMapLoader = null;
          throw error;
        });
    }
    return chinaMapLoader;
  }

  function detectRegion(school) {
    if (!school) return '';
    for (var i = 0; i < REGION_RULES.length; i++) {
      var keywords = REGION_RULES[i][1];
      for (var j = 0; j < keywords.length; j++) {
        if (school.indexOf(keywords[j]) !== -1) return REGION_RULES[i][0];
      }
    }
    return '';
  }

  /** 南海诸岛附图：九段线 + 岛礁 + 海南参照，叠在主图右下角的空白海域。 */
  function buildSouthSeaInset(southSea) {
    var inset = document.createElementNS(SVG_NS, 'svg');
    inset.setAttribute('class', 'member-map-inset');
    inset.setAttribute('viewBox', southSea.viewBox);
    inset.setAttribute('aria-hidden', 'true');
    inset.setAttribute('x', String(southSea.x));
    inset.setAttribute('y', String(southSea.y));
    inset.setAttribute('width', String(southSea.width));
    inset.setAttribute('height', String(southSea.height));

    var frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('class', 'member-map-inset-frame');
    frame.setAttribute('x', '0');
    frame.setAttribute('y', '0');
    frame.setAttribute('width', String(southSea.width));
    frame.setAttribute('height', String(southSea.height));
    inset.appendChild(frame);

    [southSea.hainan, southSea.islands].forEach(function(d) {
      if (!d) return;
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'member-map-inset-land');
      path.setAttribute('d', d);
      inset.appendChild(path);
    });

    if (southSea.dash) {
      var dash = document.createElementNS(SVG_NS, 'path');
      dash.setAttribute('class', 'member-map-inset-dash');
      dash.setAttribute('d', southSea.dash);
      inset.appendChild(dash);
    }

    var label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'member-map-inset-label');
    label.setAttribute('x', String(southSea.label.x));
    label.setAttribute('y', String(southSea.label.y));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = t('members.mapSouthChinaSea');
    inset.appendChild(label);
    return inset;
  }

  function buildMapSvg(data, regions) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'member-map-svg');
    svg.setAttribute('viewBox', data.viewBox);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('members.mapChartTitle'));

    var max = 0;
    data.provinces.forEach(function(province) {
      var count = regions[province.name] || 0;
      if (count > max) max = count;
    });

    var layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'member-map-provinces');
    data.provinces.forEach(function(province) {
      var count = regions[province.name] || 0;
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', province.path);
      path.setAttribute('class', count ? 'member-map-province is-active' : 'member-map-province');
      path.setAttribute('data-province', province.name);
      if (count && max > 0) {
        path.style.setProperty('--map-alpha', (0.3 + 0.48 * count / max).toFixed(2));
      }
      var title = document.createElementNS(SVG_NS, 'title');
      title.textContent = t('members.mapProvinceTip', province.name, count);
      path.appendChild(title);
      layer.appendChild(path);
    });
    svg.appendChild(layer);

    if (data.southSea) svg.appendChild(buildSouthSeaInset(data.southSea));
    return svg;
  }

  function buildMapLegend(max) {
    var legend = document.createElement('div');
    legend.className = 'member-map-legend';

    var title = document.createElement('span');
    title.className = 'member-map-legend-title';
    title.textContent = t('members.memberCount');
    legend.appendChild(title);

    var scale = document.createElement('span');
    scale.className = 'member-map-legend-scale';
    [0.2, 0.4, 0.6, 0.78].forEach(function(alpha) {
      var swatch = document.createElement('i');
      swatch.style.setProperty('--map-alpha', String(alpha));
      scale.appendChild(swatch);
    });
    legend.appendChild(scale);

    var hint = document.createElement('span');
    hint.className = 'member-map-legend-hint';
    hint.textContent = max > 0 ? t('members.mapLegend', max) : t('members.regionEmpty');
    legend.appendChild(hint);
    return legend;
  }

  function ensureMapTip(container) {
    var tip = container.querySelector('[data-member-map-tip]');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'member-map-tip';
      tip.setAttribute('data-member-map-tip', '');
      tip.hidden = true;
      container.appendChild(tip);
    }
    return tip;
  }

  function bindMapTooltip(container, svg, regions) {
    var tip = ensureMapTip(container);
    function hide() {
      tip.hidden = true;
    }
    svg.addEventListener('mousemove', function(event) {
      var target = event.target.closest ? event.target.closest('.member-map-province') : null;
      if (!target) {
        hide();
        return;
      }
      var name = target.getAttribute('data-province');
      tip.textContent = t('members.mapTipShort', name, regions[name] || 0);
      tip.hidden = false;
      var rect = container.getBoundingClientRect();
      tip.style.left = event.clientX - rect.left + 'px';
      tip.style.top = event.clientY - rect.top + 'px';
    });
    svg.addEventListener('mouseleave', hide);
    container.addEventListener('mouseleave', hide);
  }

  function renderVectorMap(container, regions, panel) {
    var src = container.getAttribute('data-member-map-src');
    if (!src) return Promise.resolve();
    return loadChinaProvinces(src).then(function(data) {
      if (!data || !Array.isArray(data.provinces) || !data.provinces.length) return;
      var max = 0;
      data.provinces.forEach(function(province) {
        var count = regions[province.name] || 0;
        if (count > max) max = count;
      });
      container.textContent = '';
      var svg = buildMapSvg(data, regions);
      container.appendChild(svg);
      mountMapLegend(panel, max);
      setMapNote(panel, t('members.mapNote'));
      bindMapTooltip(container, svg, regions);
      if (panel) panel.hidden = false;
    }).catch(function(error) {
      if (window.console && console.warn) console.warn('[nucma] member map failed to load:', error);
      if (panel) panel.hidden = true;
    });
  }

  function mountMapLegend(panel, max) {
    if (!panel) return;
    var existing = panel.querySelector('.member-map-legend');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var legend = buildMapLegend(max);
    var note = panel.querySelector('.member-map-note');
    if (note && note.parentNode) note.parentNode.insertBefore(legend, note);
    else panel.appendChild(legend);
  }

  function setMapNote(panel, text) {
    var note = panel ? panel.querySelector('.member-map-note') : null;
    if (note) note.textContent = text;
  }

  function cardDate(card) {
    var raw = card.getAttribute('data-created');
    if (!raw) return null;
    var parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(date) {
    if (!date) return t('members.unknown');
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function relativeDays(date) {
    if (!date) return '';
    var days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return t('members.today');
    if (days === 1) return t('members.yesterday');
    if (days < 30) return t('members.daysAgo', days);
    if (days < 365) return t('members.monthsAgo', Math.floor(days / 30));
    return t('members.yearsAgo', Math.floor(days / 365));
  }

  function initMemberOverview(cards) {
    var overview = document.querySelector('[data-member-overview]');
    if (!overview || !cards.length) return;

    var groups = {};
    var schools = {};
    var regions = {};
    var recentCutoff = Date.now() - 30 * 86400000;
    var recent = 0;
    var dated = [];

    cards.forEach(function(card) {
      var group = (card.getAttribute('data-group') || '').trim();
      var school = (card.getAttribute('data-school') || '').trim();
      var created = cardDate(card);
      if (group) groups[group] = true;
      if (school) {
        schools[school] = true;
        var region = detectRegion(school);
        if (region) regions[region] = (regions[region] || 0) + 1;
      }
      if (created) {
        if (created.getTime() >= recentCutoff) recent++;
        dated.push({ card: card, date: created, group: group || t('members.ungrouped') });
      }
    });

    function setStat(name, value) {
      var el = overview.querySelector('[data-stat-' + name + ']');
      if (el) el.textContent = String(value);
    }

    setStat('total', cards.length);
    setStat('groups', Object.keys(groups).length);
    setStat('schools', Object.keys(schools).length);
    setStat('recent', recent);

    var regionList = overview.querySelector('[data-member-region-list]');
    var regionEmpty = overview.querySelector('[data-member-region-empty]');
    var regionEntries = Object.keys(regions)
      .map(function(name) { return { name: name, count: regions[name] }; })
      .sort(function(a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'); })
      .slice(0, 8);

    if (regionList) {
      regionList.textContent = '';
      regionEntries.forEach(function(entry) {
        var item = document.createElement('li');
        item.className = 'member-region-item';
        var max = regionEntries[0].count || 1;
        item.innerHTML =
          '<span class="member-region-name"></span>' +
          '<span class="member-region-bar" aria-hidden="true"><span class="member-region-fill"></span></span>' +
          '<span class="member-region-count"></span>';
        item.querySelector('.member-region-name').textContent = entry.name;
        item.querySelector('.member-region-fill').style.width = Math.max(6, Math.round(entry.count / max * 100)) + '%';
        item.querySelector('.member-region-count').textContent = String(entry.count);
        regionList.appendChild(item);
      });
    }
    if (regionEmpty) regionEmpty.hidden = regionEntries.length > 0;

    var timeline = overview.querySelector('[data-member-timeline]');
    var timelineEmpty = overview.querySelector('[data-member-timeline-empty]');
    dated.sort(function(a, b) { return b.date - a.date; });
    var latest = dated.slice(0, 6);

    if (timeline) {
      timeline.textContent = '';
      latest.forEach(function(entry) {
        var nameEl = entry.card.querySelector('.member-name');
        var item = document.createElement('li');
        item.className = 'member-timeline-item';
        item.innerHTML =
          '<span class="member-timeline-dot" aria-hidden="true"></span>' +
          '<div class="member-timeline-body">' +
            '<span class="member-timeline-name"></span>' +
            '<span class="member-timeline-meta"></span>' +
          '</div>' +
          '<time class="member-timeline-time"></time>';
        item.querySelector('.member-timeline-name').textContent = nameEl ? nameEl.textContent.trim() : t('members.labelMembers');
        item.querySelector('.member-timeline-meta').textContent = entry.group;
        var time = item.querySelector('.member-timeline-time');
        time.textContent = relativeDays(entry.date);
        time.dateTime = entry.date.toISOString();
        time.title = formatDate(entry.date);
        timeline.appendChild(item);
      });
    }
    if (timelineEmpty) timelineEmpty.hidden = latest.length > 0;

    var mapContainer = overview.querySelector('[data-member-map]');
    if (mapContainer) {
      renderVectorMap(mapContainer, regions, overview.querySelector('[data-member-map-panel]'));
    }

    var toggle = overview.querySelector('[data-overview-toggle]');
    var body = overview.querySelector('[data-overview-body]');
    if (toggle && body) {
      toggle.addEventListener('click', function() {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        body.hidden = expanded;
        var label = toggle.querySelector('[data-overview-toggle-text]');
        if (label) label.textContent = expanded ? t('members.overviewToggle') : t('members.collapse');
      });
    }

    overview.hidden = false;
  }

  /* 成员页工牌弹层：挂绳、卡扣、拖拽与入场全部由 err404.js 驱动，
     这里只负责打开/关闭、把点击的成员交给工牌、以及键盘可及性。 */
  function initMemberBadge(opts) {
    var options = opts || {};
    var triggers = Array.from(document.querySelectorAll('[data-member-preview]'));
    var overlay = document.getElementById('memberBadge');
    if (!triggers.length || !overlay) return;
    if (!document.getElementById('badge') || typeof window.__badgeSetMember !== 'function') return;

    var closeButton = overlay.querySelector('.member-badge-back');
    var saveButton = overlay.querySelector('[data-member-badge-save]');
    var saveLabel = overlay.querySelector('[data-member-badge-save-label]');
    var saveStatus = overlay.querySelector('[data-member-badge-save-status]');
    var conf = window.__ERR404__ || {};
    var currentCard = null;
    var saving = false;
    var saveTimer = 0;
    var lastFocus = null;
    var pendingScroll = null;

    /* 分享图预览层：点「保存工作证」先出图，不直接下载 */
    var preview = document.getElementById('badgePreview');
    var previewImg = preview ? preview.querySelector('[data-badge-preview-img]') : null;
    var previewState = preview ? preview.querySelector('[data-badge-preview-state]') : null;
    var previewDownload = preview ? preview.querySelector('[data-badge-preview-download]') : null;
    var previewTip = preview ? preview.querySelector('[data-badge-preview-tip]') : null;
    var previewStage = preview ? preview.querySelector('.badge-preview-stage') : null;
    var previewCloseBtn = preview ? preview.querySelector('.badge-preview-close') : null;
    var previewOpen = false;
    var previewSeq = 0;
    var previewReturnFocus = null;
    var previewCloseTimer = 0;
    /* 淡出时长与 .badge-preview.is-closing 的 0.22s 对齐；多留一点收尾余量 */
    var PREVIEW_FADE_MS = 240;
    var poolIndex = {};
    Array.prototype.forEach.call(document.querySelectorAll('#err404MemberData .err404-member'), function(node, index) {
      var mid = node.getAttribute('data-mid');
      if (mid) poolIndex[mid] = index;
    });

    function badgeShareData(card) {
      var text = function(selector) {
        var el = card.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };
      var avatarImg = card.querySelector('.member-avatar img');
      var link = card.tagName === 'A' ? card.getAttribute('href') || '' : '';
      var introEl = document.getElementById('backIntro');
      var statusEl = document.getElementById('badgeStatus');
      return {
        name: text('.member-name'),
        school: card.getAttribute('data-school') || '',
        group: card.getAttribute('data-group') || '',
        joined: card.getAttribute('data-created') || '',
        qq: card.getAttribute('data-qq') || '',
        link: /^https?:\/\//i.test(link) ? link : '',
        avatar: avatarImg ? avatarImg.currentSrc || avatarImg.src : '',
        intro: introEl ? introEl.textContent.trim() : '',
        status: statusEl ? statusEl.textContent.trim() : '',
        verified: card.classList.contains('member-card-verified'),
        qr: document.getElementById('badgeQr'),
        logo: conf.siteLogo || '',
        siteTitle: conf.siteTitle || document.title,
        strapColor: conf.strapColor || '#cf3538'
      };
    }

    function resetSave() {
      clearTimeout(saveTimer);
      if (!saveButton) return;
      saving = false;
      saveButton.disabled = false;
      if (saveLabel) saveLabel.textContent = t('members.badgeSave');
      if (saveStatus) saveStatus.textContent = '';
    }

    var returnMarked = null;

    function clearBadgeReturn() {
      if (!returnMarked) return;
      returnMarked.classList.remove('is-badge-return');
      returnMarked = null;
    }

    function markBadgeReturn(card) {
      clearBadgeReturn();
      if (!card || !card.classList.contains('member-card')) return;
      card.classList.add('is-badge-return');
      returnMarked = card;
      ['pointerdown', 'keydown'].forEach(function(type) {
        document.addEventListener(type, clearBadgeReturn, { once: true, capture: true });
      });
      /* 悬停也要撤：撤掉之后二维码浮层才回到主题原来的 hover 行为 */
      card.addEventListener('pointerenter', clearBadgeReturn, { once: true });
    }

    function open(memberCard, trigger, opts) {
      var silentFocus = !!(opts && opts.silentFocus);
      clearBadgeReturn();
      lastFocus = trigger || document.activeElement;
      currentCard = memberCard;
      resetSave();
      var mid = trigger.getAttribute('data-member-id') || '';
      var idx = Object.prototype.hasOwnProperty.call(poolIndex, mid) ? poolIndex[mid] : 0;
      window.__badgeSetMember(idx);

      /* 插件成员池不带简介、认证状态，用成员卡片上的原文补上 */
      var descriptionEl = memberCard.querySelector('[data-member-description]');
      var description = descriptionEl ? descriptionEl.textContent.trim() : '';
      var introEl = document.getElementById('backIntro');
      if (introEl) {
        introEl.textContent = description;
        introEl.classList.toggle('is-empty', !description);
      }
      var statusBadge = memberCard.querySelector('.member-status-badge');
      var statusEl = document.getElementById('badgeStatus');
      if (statusBadge && statusEl) {
        statusEl.textContent = statusBadge.textContent.trim();
        statusEl.classList.toggle('is-vip', memberCard.classList.contains('member-card-verified'));
      }

      if (typeof window.__badgeRest === 'function') window.__badgeRest();
      overlay.removeAttribute('inert');
      overlay.classList.add('is-open');
      document.documentElement.classList.add('member-badge-open');
      /* preventScroll：弹层是 fixed 的，但浏览器为了「把焦点元素纳入视口」照样会滚底层页面，
         半透明遮罩下就表现为一进页面就下滑。
         silentFocus：深链落地时页面还没有任何键鼠交互，程序化 focus 一律按 :focus-visible
         画环，所以焦点交给弹层容器（不画环）而不是返回按钮；手动点眼睛时维持原来的焦点位置。 */
      function focusInside() {
        (silentFocus ? overlay : closeButton).focus({ preventScroll: true });
      }
      focusInside();
      /* 打开后滚动条消失、视口变宽，先重量尺寸再播入场 */
      requestAnimationFrame(function() {
        /* 首帧兜底：样式刚切到可见时 focus() 可能落空，焦点必须在弹层里 */
        if (!overlay.contains(document.activeElement)) focusInside();
        if (typeof window.__badgeMeasure === 'function') window.__badgeMeasure();
        requestAnimationFrame(function() {
          if (typeof window.__badgeDrop === 'function') window.__badgeDrop();
        });
      });
    }

    function close() {
      if (!overlay.classList.contains('is-open')) return;
      if (previewOpen) closePreview();
      overlay.classList.remove('is-open');
      overlay.classList.remove('is-previewing');   /* 关弹层时别把操作条留在透明态 */
      overlay.setAttribute('inert', '');
      document.documentElement.classList.remove('member-badge-open');
      /* 关闭后高亮跟着那张卡，不再让卡右上角的眼睛带环；未补全的 div 卡片靠 tabindex="-1" 才接得住焦点。
         高亮写在 .is-badge-return 上而不是等 :focus-visible：主题原有的卡片高亮挂在 :focus-visible，
         鼠标点「返回成员列表」时程序化 focus 不算键盘交互、判不出环，只有键盘路径会亮，
         补一个类让深链 / 鼠标 / 键盘三条路径表现一致；任何真实交互（点、键、悬停）就撤。 */
      var returnTarget = currentCard && document.contains(currentCard) ? currentCard : lastFocus;
      if (returnTarget && document.contains(returnTarget)) returnTarget.focus({ preventScroll: true });
      lastFocus = null;
      markBadgeReturn(returnTarget);
      /* 深链带进来的那张卡等弹层真关掉了再滚，打开期间底层一动不动；
         slot 早被 revealAll 放行过，这里只负责滚进视口。 */
      if (pendingScroll && document.contains(pendingScroll)) {
        pendingScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      pendingScroll = null;
    }

    overlay.querySelectorAll('[data-member-badge-close]').forEach(function(el) {
      el.addEventListener('click', close);
    });

    /* ---------------- 分享图预览 ---------------- */

    function setPreviewState(text, isError) {
      if (!previewState) return;
      previewState.hidden = !text;
      previewState.textContent = text || '';
      previewState.classList.toggle('is-error', !!isError);
      /* 生成中给一个等比例骨架，别让面板先塌再撑 */
      if (previewStage) previewStage.classList.toggle('is-loading', !!text && !isError);
    }

    function clearPreviewArt() {
      if (previewImg) {
        previewImg.hidden = true;
        previewImg.removeAttribute('src');
      }
      if (previewDownload) {
        previewDownload.hidden = true;
        previewDownload.removeAttribute('href');
      }
      if (previewTip) previewTip.hidden = true;
    }

    function openPreview(returnTo) {
      if (!preview) return 0;
      previewSeq += 1;
      previewOpen = true;
      previewReturnFocus = returnTo || document.activeElement;
      /* 从淡出过程中抢回来：撤掉 is-closing 会让淡入动画重播 */
      clearTimeout(previewCloseTimer);
      previewCloseTimer = 0;
      preview.classList.remove('is-closing');
      /* 预览期间把工牌那条操作条淡掉：预览层没有黑底，不淡会露出两排按钮 */
      overlay.classList.add('is-previewing');
      clearPreviewArt();
      setPreviewState(t('members.badgeSaving'));
      preview.hidden = false;
      if (previewCloseBtn) previewCloseBtn.focus();
      return previewSeq;
    }

    function closePreview() {
      if (!preview || !previewOpen) return;
      previewOpen = false;
      previewSeq += 1;        /* 作废进行中的生成，别让它把图写回已关掉的层 */
      if (saveStatus) saveStatus.textContent = '';

      var target = previewReturnFocus;
      previewReturnFocus = null;

      function finish() {
        previewCloseTimer = 0;
        preview.classList.remove('is-closing');
        preview.hidden = true;
        overlay.classList.remove('is-previewing');
        clearPreviewArt();
        setPreviewState('');
        /* 「保存工作证」在生成期间是 disabled，聚焦不了，退回「返回成员列表」 */
        if (target && document.contains(target) && !target.disabled) {
          target.focus();
        } else if (closeButton && document.contains(closeButton)) {
          closeButton.focus();
        }
      }

      /* 淡出跑完再藏；关了动效偏好就立刻收 */
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { finish(); return; }
      preview.classList.add('is-closing');
      clearTimeout(previewCloseTimer);
      previewCloseTimer = setTimeout(finish, PREVIEW_FADE_MS);
    }

    if (preview) {
      preview.querySelectorAll('[data-badge-preview-close]').forEach(function(el) {
        el.addEventListener('click', closePreview);
      });
    }

    function shareFileName(data) {
      var safe = String(data.name || data.siteTitle || 'member').replace(/[\\/:*?"<>|\s]+/g, '-');
      return 'NUCMA-' + safe + '-' + t('members.badgeFileName') + '.png';
    }

    /* 转成 data URL 再交给 <img>：iOS Safari 长按 blob: 图片不一定给「存储图像」，
       data: 则一定出现在长按菜单里，手机存相册才不会落空。 */
    function blobToDataUrl(blob) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { resolve(''); };
        reader.readAsDataURL(blob);
      });
    }

    /* 兜底：预览层缺失时仍按老路直接下载，不让「保存」变成死按钮 */
    function downloadBlob(blob, name) {
      var href = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function() { URL.revokeObjectURL(href); }, 6000);
    }

    if (saveButton) {
      saveButton.addEventListener('click', function() {
        if (saving || !currentCard) return;
        saving = true;
        clearTimeout(saveTimer);
        saveButton.disabled = true;
        if (saveLabel) saveLabel.textContent = t('members.badgeSaving');
        if (saveStatus) saveStatus.textContent = '';
        var data = badgeShareData(currentCard);
        var seq = openPreview(saveButton);
        renderBadgeShare(data).then(function(blob) {
          if (!seq) {
            downloadBlob(blob, shareFileName(data));
            if (saveLabel) saveLabel.textContent = t('members.badgeSaved');
            if (saveStatus) saveStatus.textContent = t('members.badgeSavedHint');
            saveTimer = setTimeout(function() {
              if (saveLabel) saveLabel.textContent = t('members.badgeSave');
              if (saveStatus) saveStatus.textContent = '';
            }, 2600);
            return;
          }
          return blobToDataUrl(blob).then(function(url) {
            if (!url) throw new Error('badge data url failed');
            if (seq !== previewSeq) return;      /* 预览已被关掉，丢弃这次结果 */
            if (previewImg) {
              previewImg.src = url;
              previewImg.hidden = false;
            }
            if (previewDownload) {
              previewDownload.href = url;
              previewDownload.download = shareFileName(data);
              previewDownload.hidden = false;
            }
            if (previewTip) previewTip.hidden = false;
            setPreviewState('');
          });
        }).catch(function() {
          if (seq && seq !== previewSeq) return;
          if (seq) {
            setPreviewState(t('members.badgeSaveFailed'), true);
          } else if (saveStatus) {
            saveStatus.textContent = t('members.badgeSaveFailed');
          }
        }).then(function() {
          saving = false;
          if (saveButton) saveButton.disabled = false;
          /* 进了预览层的分支要复位文案；兜底下载分支保留「已保存」 */
          if (seq && saveLabel) saveLabel.textContent = t('members.badgeSave');
        });
      });
    }

    /* 本地验证钩子：直接拿到当前成员的分享图 Blob，不触发下载 */
    window.__badgeShare = function() {
      if (!currentCard) return Promise.reject(new Error('no member'));
      return renderBadgeShare(badgeShareData(currentCard));
    };

    /* 精准命中：按下点在卡片 / 吊带 / 卡扣上才交给物理引擎，
       其余位置的「点击」关闭弹层；拖拽（位移超过 8px）不算点击。 */
    var press = null;
    overlay.addEventListener('pointerdown', function(event) {
      if (!overlay.classList.contains('is-open') || event.button) { press = null; return; }
      press = {
        x: event.clientX,
        y: event.clientY,
        hit: typeof window.__badgeHit === 'function' &&
          window.__badgeHit(event.target, event.clientX, event.clientY),
        chrome: !!(event.target.closest &&
          event.target.closest('[data-member-badge-close], [data-member-badge-save], .member-badge-actions'))
      };
    }, true);
    overlay.addEventListener('pointerup', function(event) {
      if (!press || event.button) { press = null; return; }
      var start = press;
      press = null;
      if (start.chrome || start.hit) return;
      if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 8) return;
      close();
    }, true);
    overlay.addEventListener('pointercancel', function() { press = null; }, true);

    document.addEventListener('keydown', function(event) {
      /* 预览层在上面：Esc 只关预览，Tab 也只在这一层里循环 */
      if (previewOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closePreview();
          return;
        }
        if (event.key !== 'Tab' || !preview) return;
        var pvList = Array.from(preview.querySelectorAll('a[href], button'))
          .filter(function(el) { return !el.hidden && el.offsetParent !== null; });
        if (!pvList.length) return;
        var pvFirst = pvList[0];
        var pvLast = pvList[pvList.length - 1];
        if (!preview.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? pvLast : pvFirst).focus();
        } else if (event.shiftKey && document.activeElement === pvFirst) {
          event.preventDefault();
          pvLast.focus();
        } else if (!event.shiftKey && document.activeElement === pvLast) {
          event.preventDefault();
          pvFirst.focus();
        }
        return;
      }
      if (!overlay.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusable = Array.from(overlay.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])'))
        .filter(function(el) { return !el.hidden && el.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (!overlay.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    triggers.forEach(function(trigger) {
      var memberCard = trigger.closest('.member-card-slot')?.querySelector('.member-card');
      if (!memberCard) return;
      trigger.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        open(memberCard, trigger);
      });
    });

    /* 站内搜索的成员卡片带 ?badge=<成员ID> 跳过来，就直接弹那张工牌。
       信息流是分批放行的（没放行的 slot 是 display:none，滚不动），页面也可能停在星图视图，
       所以先切回网格、放行全部匹配卡，再开弹层；ID 查不到就当普通落地。
       那张卡的位置留到关弹层时才滚（pendingScroll），打开期间底层不跳。 */
    if (!options.badgeId) return;
    var target = triggers.filter(function(trigger) {
      return trigger.getAttribute('data-member-id') === options.badgeId;
    })[0];
    if (!target) return;
    var targetSlot = target.closest('.member-card-slot');
    var targetCard = targetSlot ? targetSlot.querySelector('.member-card') : null;
    if (!targetCard) return;
    if (options.network) options.network.setMode('grid', false);
    if (options.filters) options.filters.revealAll();
    pendingScroll = targetSlot;
    requestAnimationFrame(function() { open(targetCard, target, { silentFocus: true }); });
  }

  function initMemberFilters(cards, onFilterChange) {
    if (!cards.length) return;
    var searchInput = document.getElementById('memberSearchInput');
    if (!searchInput) return;

    var groups = Array.from(document.querySelectorAll('.member-group'));
    var searchEmpty = document.getElementById('memberSearchEmpty');
    var sentinel = document.querySelector('[data-member-feed-sentinel]');
    var sentinelStatus = document.querySelector('[data-member-feed-status]');
    // 页头标题右侧的成员总数徽标，与友链页、分组小标题后的计数同款
    var totalBadge = document.getElementById('memberTotalCount');
    var totalCards = cards.length;

    var textCache = new WeakMap();
    var pinyin = null;
    var searchTimer = null;
    var searchRevision = 0;
    var tokens = [];
    var revealed = REVEAL_BATCH;
    var matchedCards = [];

    function cardText(card) {
      if (!textCache.has(card)) {
        var name = card.querySelector('.member-name')?.textContent?.trim() || '';
        var school = card.querySelector('.member-school')?.textContent?.trim() || '';
        var group = (card.getAttribute('data-group') || '').trim();
        var qq = (card.getAttribute('data-qq') || '').trim();
        var cache = {
          name: name.toLowerCase(),
          school: school.toLowerCase(),
          group: group.toLowerCase(),
          qq: qq.toLowerCase(),
          region: detectRegion(school),
          pinyin: '',
          initials: ''
        };
        if (pinyin) {
          cache.pinyin = pinyin(name + ' ' + school + ' ' + group, { toneType: 'none', type: 'array' }).join('').toLowerCase();
          cache.initials = pinyin(name + ' ' + school + ' ' + group, { pattern: 'first', type: 'array' }).join('').toLowerCase();
        }
        textCache.set(card, cache);
      }
      return textCache.get(card);
    }

    function tokenMatches(card, token) {
      var data = cardText(card);
      // i18n-ignore 匹配后台提交的字段名，属于内容解析而非界面文案
      var fieldMatch = /^(学校|school|分组|group|qq|地区|region)[:：](.+)$/i.exec(token);
      if (fieldMatch) {
        var field = fieldMatch[1].toLowerCase();
        var value = fieldMatch[2].trim();
        if (!value) return true;
        if (field === t('members.school') || field === 'school') return data.school.indexOf(value) !== -1;
        if (field === t('members.labelGroups') || field === 'group') return data.group.indexOf(value) !== -1;
        if (field === 'qq') return data.qq.indexOf(value) !== -1;
        return data.region.toLowerCase().indexOf(value) !== -1;
      }
      if (data.name.indexOf(token) !== -1) return true;
      if (data.school.indexOf(token) !== -1) return true;
      if (data.group.indexOf(token) !== -1) return true;
      if (data.region.toLowerCase().indexOf(token) !== -1) return true;
      if (data.qq.indexOf(token) !== -1 && /^\d+$/.test(token)) return true;
      if (!pinyin) return false;
      return data.pinyin.indexOf(token) !== -1 || data.initials.indexOf(token) !== -1;
    }

    function matchesKeyword(card) {
      if (!tokens.length) return true;
      for (var i = 0; i < tokens.length; i++) {
        if (!tokenMatches(card, tokens[i])) return false;
      }
      return true;
    }

    function cardMatchesFilters(card) {
      return matchesKeyword(card);
    }

    function updateSentinel() {
      if (!sentinel) return;
      var remaining = matchedCards.length - revealed;
      sentinel.hidden = remaining <= 0;
      if (sentinelStatus) {
        sentinelStatus.textContent = remaining > 0
          ? t('members.feedMore', remaining)
          : t('members.feedDone');
      }
    }

    function recompute() {
      matchedCards = cards.filter(cardMatchesFilters);
      var matchedSet = new Set(matchedCards);
      var shownSet = new Set(matchedCards.slice(0, revealed));

      cards.forEach(function(card) {
        var slot = card.closest('.member-card-slot') || card;
        slot.style.display = shownSet.has(card) ? '' : 'none';
      });

      groups.forEach(function(group) {
        var groupCards = Array.from(group.querySelectorAll('.member-card'));
        var matched = groupCards.filter(function(card) { return matchedSet.has(card); }).length;
        var shown = groupCards.some(function(card) { return shownSet.has(card); });
        group.style.display = shown ? '' : 'none';
        var count = group.querySelector('.member-group-count');
        if (count) count.textContent = String(matched);
      });

      if (searchEmpty) searchEmpty.hidden = matchedCards.length > 0;
      if (totalBadge) {
        var keywordActive = tokens.length > 0;
        totalBadge.textContent = keywordActive
          ? matchedCards.length + '/' + totalCards
          : String(totalCards);
        totalBadge.title = keywordActive
          ? t('members.searchHit', matchedCards.length, totalCards)
          : t('members.totalCount', totalCards);
        totalBadge.hidden = false;
      }
      updateSentinel();
      if (onFilterChange) onFilterChange(matchedCards);
    }

    function scheduleReveal() {
      revealed += REVEAL_BATCH;
      recompute();
      requestAnimationFrame(function() {
        if (sentinel && !sentinel.hidden && sentinel.getBoundingClientRect().top < window.innerHeight + 200) {
          scheduleReveal();
        }
      });
    }

    if (sentinel && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) scheduleReveal();
        });
      }, { rootMargin: '400px 0px' });
      observer.observe(sentinel);
    }

    async function updateKeyword() {
      var revision = ++searchRevision;
      var raw = searchInput ? searchInput.value.trim() : '';
      tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);

      if (tokens.length && !pinyin && /[a-z]/i.test(raw)) {
        try {
          var resolved = await loadPinyin();
          if (revision !== searchRevision) return;
          pinyin = resolved;
          textCache = new WeakMap();
        } catch (_) {}
      }
      if (revision !== searchRevision) return;
      revealed = REVEAL_BATCH;
      recompute();
    }

    function resetFilters() {
      if (searchInput) searchInput.value = '';

      tokens = [];
      revealed = REVEAL_BATCH;
      recompute();
    }

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(updateKeyword, 160);
      });
    }

    revealed = REVEAL_BATCH;
    recompute();

    return {
      revealAll: function() {
        revealed = matchedCards.length;
        recompute();
      }
    };
  }

  function initMemberNetwork() {
    var section = document.querySelector('[data-member-network]');
    if (!section) {
      return createMemberNetwork({ section: null, canvas: null });
    }
    // 学校关联展示配置由主题设置注入到容器的 data-* 上，缺省为「开启 + 不设阈值」
    var affinityMin = parseFloat(section.getAttribute('data-affinity-min-strength'));
    return createMemberNetwork({
      section: section,
      canvas: section.querySelector('[data-member-network-canvas]'),
      tip: section.querySelector('[data-member-network-tip]'),
      countEl: section.querySelector('[data-member-network-count]'),
      listEl: section.querySelector('[data-member-network-list]'),
      affinityEl: section.querySelector('[data-member-network-affinity]'),
      linkTipEl: section.querySelector('[data-member-network-link-tip]'),
      defaultMode: section.getAttribute('data-default-view') === 'network' ? 'network' : 'grid',
      affinity: {
        enabled: section.getAttribute('data-affinity-enabled') !== 'false',
        minStrength: isNaN(affinityMin) ? 0 : affinityMin,
        showReason: section.getAttribute('data-affinity-show-reason') !== 'false'
      },
      container: document.querySelector('.directory-content--members'),
      buttons: Array.from(document.querySelectorAll('[data-member-view]'))
    });
  }

  function initMemberQrPopups() {
    var canvases = Array.from(document.querySelectorAll('[data-member-qr]'));
    if (!canvases.length) return;
    var desktopMedia = window.matchMedia('(min-width: 768px) and (hover: hover)');

    // 成员卡数量可能上百：退让位置统一走一个 resize 监听 + rAF 合帧，
    // 避免每张卡各挂一个监听、每次 resize 触发上百次 getBoundingClientRect。
    var placementUpdaters = new Set();
    var placementFrame = 0;

    function runPlacementUpdates() {
      placementFrame = 0;
      placementUpdaters.forEach(function(update) { update(); });
    }

    function schedulePlacementUpdates() {
      if (placementFrame) return;
      placementFrame = window.requestAnimationFrame(runPlacementUpdates);
    }

    window.addEventListener('resize', schedulePlacementUpdates, { passive: true });
    desktopMedia.addEventListener('change', schedulePlacementUpdates);

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
        if (status) status.textContent = t('members.qrReady');
      } catch (_) {
        delete canvas.dataset.qrState;
        popup.classList.remove('is-loading', 'is-ready');
        popup.classList.add('is-error');
        if (status) status.textContent = t('members.qrFailed');
      }
    }

    canvases.forEach(function(canvas) {
      var card = canvas.closest('.member-card');
      var popup = canvas.closest('[data-member-qr-popup]');
      if (!card || !popup) return;

      function setPopupVisible(visible) {
        popup.setAttribute('aria-hidden', visible && desktopMedia.matches ? 'false' : 'true');
      }

      function updatePlacement() {
        popup.classList.remove('is-flipped', 'is-inside');
        if (!desktopMedia.matches) {
          popup.setAttribute('aria-hidden', 'true');
          return;
        }
        var cardRect = card.getBoundingClientRect();
        var popupWidth = popup.offsetWidth || 0;
        if (!popupWidth) return;
        var rightSpace = window.innerWidth - cardRect.right - 20;
        var leftSpace = cardRect.left - 20;
        if (rightSpace >= popupWidth) return;
        if (leftSpace >= popupWidth) {
          popup.classList.add('is-flipped');
        } else {
          popup.classList.add('is-inside');
        }
      }

      setPopupVisible(false);
      card.addEventListener('pointerenter', function() {
        updatePlacement();
        setPopupVisible(true);
        renderQr(canvas);
      }, { passive: true });
      card.addEventListener('pointerleave', function() { setPopupVisible(false); }, { passive: true });
      card.addEventListener('focusin', function() {
        updatePlacement();
        setPopupVisible(true);
        renderQr(canvas);
      });
      card.addEventListener('focusout', function(event) {
        if (!card.contains(event.relatedTarget)) setPopupVisible(false);
      });
      placementUpdaters.add(updatePlacement);
    });
  }

  function initClaimModal() {
    var modal = document.getElementById('claimModal');
    if (!modal) return;

    var API_BASE = '/apis/api.plugin.halo.run/v1alpha1';
    var CLAIM_ENDPOINT = API_BASE + '/plugins/PluginMembers/claim';
    var SEND_CODE_ENDPOINT = API_BASE + '/plugins/PluginMembers/claim/send-code';
    var VERIFY_MODE_ENDPOINT = API_BASE + '/plugins/PluginMembers/claim/verification-mode';
    // 图形验证码挂在 MemberEndpoint 的 groupVersion 下，与 claim 端点前缀不同
    var CAPTCHA_ENDPOINT = '/apis/api.member.plugin.halo.run/v1alpha1/membersubmits/-/captcha';
    var openBtns = document.querySelectorAll('[data-claim-modal-open]');
    var closeBtns = modal.querySelectorAll('[data-claim-modal-close]');
    var step1 = modal.querySelector('[data-claim-step="1"]');
    var step2 = modal.querySelector('[data-claim-step="2"]');
    var successBox = modal.querySelector('#claimSuccess');
    var errorBox = modal.querySelector('#claimError');
    var errorMsg = modal.querySelector('[data-claim-error-message]');
    var retryBtn = modal.querySelector('[data-claim-retry]');
    var submitBtn = modal.querySelector('[data-claim-submit]');
    var submitText = modal.querySelector('[data-claim-submit-text]');
    var submitLoading = modal.querySelector('[data-claim-submit-loading]');
    var qqInput = modal.querySelector('#claimQq');
    var nameInput = modal.querySelector('#claimName');
    var schoolInput = modal.querySelector('#claimSchool');
    var linkInput = modal.querySelector('#claimLink');
    var codeInput = modal.querySelector('#claimCode');
    var sendCodeBtn = modal.querySelector('[data-send-code]');
    var sendCodeText = modal.querySelector('[data-send-code-text]');
    var sendCodeLoading = modal.querySelector('[data-send-code-loading]');
    var codeHint = modal.querySelector('#claimCodeHint');
    var emailField = modal.querySelector('[data-claim-email-field]');
    var captchaField = modal.querySelector('[data-claim-captcha]');
    var captchaInput = modal.querySelector('#claimCaptchaCode');
    var captchaImg = modal.querySelector('[data-claim-captcha-img]');
    var captchaRefresh = modal.querySelector('[data-claim-captcha-refresh]');
    var captchaHint = modal.querySelector('[data-claim-captcha-hint]');
    var avatarPreview = modal.querySelector('[data-claim-avatar-preview]');
    var avatarFallback = modal.querySelector('[data-claim-avatar-fallback]');

    var countdownTimer = null;
    var defaultAvatarUrl = '';
    // 本次弹窗是从哪张卡片的补全按钮打开的，提交成功后回写该按钮状态
    var currentButton = null;
    var claimed = false;
    // 认领验证方式：captcha / email / none，由插件设置决定
    var verifyMode = 'email';
    var captchaChallengeId = '';

    function fetchVerifyMode() {
      return fetch(VERIFY_MODE_ENDPOINT, { headers: { 'Accept': 'application/json' } })
        .then(function(resp) { return resp.ok ? resp.json() : { mode: 'email' }; })
        .then(function(data) { return data && data.mode ? data.mode : 'email'; })
        .catch(function() { return 'email'; });
    }

    function loadCaptcha() {
      if (!captchaImg) return;
      captchaHint.classList.remove('text-error');
      captchaHint.textContent = t('members.captchaLoading');
      captchaChallengeId = '';
      fetch(CAPTCHA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
        .then(function(resp) {
          if (!resp.ok) throw new Error('captcha');
          return resp.json();
        })
        .then(function(data) {
          captchaChallengeId = data.challengeId || '';
          if (data.image) captchaImg.src = data.image;
          captchaHint.textContent = t('members.claimCaptchaHint');
        })
        .catch(function() {
          captchaChallengeId = '';
          captchaHint.textContent = t('members.captchaFailed');
          captchaHint.classList.add('text-error');
        });
    }

    function applyVerifyMode(mode) {
      verifyMode = mode === 'captcha' || mode === 'none' ? mode : 'email';
      if (emailField) emailField.hidden = verifyMode !== 'email';
      if (captchaField) captchaField.hidden = verifyMode !== 'captcha';
      if (verifyMode === 'captcha') loadCaptcha();
    }

    if (captchaRefresh) {
      captchaRefresh.addEventListener('click', function() { loadCaptcha(); });
    }

    function setAvatarPreview(url) {
      if (url) {
        avatarPreview.src = url;
        avatarPreview.hidden = false;
        avatarFallback.hidden = true;
      } else {
        avatarPreview.removeAttribute('src');
        avatarPreview.hidden = true;
        avatarFallback.hidden = false;
      }
    }

    function openModal(btn) {
      modal.showModal();
      resetForm();
      currentButton = btn || null;
      claimed = false;
      fetchVerifyMode().then(applyVerifyMode);

      var claimQq = btn ? btn.getAttribute('data-claim-qq') || '' : '';
      defaultAvatarUrl = defaultQqAvatar(claimQq);

      qqInput.value = claimQq;
      nameInput.value = btn ? btn.getAttribute('data-claim-name') || '' : '';
      schoolInput.value = btn ? btn.getAttribute('data-claim-school') || '' : '';
      // 头像只读：统一展示 QQ 头像，忽略成员资料里可能残留的自定义头像
      setAvatarPreview(defaultAvatarUrl);
      linkInput.focus();
    }

    function closeModal() {
      modal.close();
    }

    function resetForm() {
      step1.hidden = false;
      step2.hidden = true;
      successBox.hidden = true;
      errorBox.hidden = true;
      retryBtn.hidden = true;
      qqInput.value = '';
      qqInput.setAttribute('readonly', '');
      nameInput.value = '';
      schoolInput.value = '';
      linkInput.value = '';
      codeInput.value = '';
      defaultAvatarUrl = '';
      setAvatarPreview('');
      submitBtn.disabled = false;
      submitText.hidden = false;
      submitLoading.hidden = true;
      sendCodeBtn.disabled = false;
      sendCodeText.hidden = false;
      sendCodeLoading.hidden = true;
      codeHint.textContent = t('members.claimCodeHint');
      codeHint.classList.remove('text-error');
      if (captchaInput) captchaInput.value = '';
      captchaChallengeId = '';
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }

    function startCountdown(seconds) {
      sendCodeBtn.disabled = true;
      var remaining = seconds;
      sendCodeText.textContent = t('members.resendIn', remaining);
      countdownTimer = setInterval(function() {
        remaining--;
        if (remaining <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          sendCodeBtn.disabled = false;
          sendCodeText.textContent = t('members.claimSendCode');
        } else {
          sendCodeText.textContent = t('members.resendIn', remaining);
        }
      }, 1000);
    }

    async function sendCode() {
      var qq = qqInput.value.trim();
      if (!qq) {
        qqInput.focus();
        return;
      }

      sendCodeBtn.disabled = true;
      sendCodeText.hidden = true;
      sendCodeLoading.hidden = false;

      try {
        var resp = await fetch(SEND_CODE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qq: qq })
        });

        var data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.detail || data.message || t('members.sendFailed'));
        }

        codeHint.textContent = data.message || t('members.sent');
        codeHint.classList.remove('text-error');
        codeInput.focus();
        startCountdown(60);
      } catch (err) {
        codeHint.textContent = err.message || t('members.sendFailedRetry');
        codeHint.classList.add('text-error');
        sendCodeBtn.disabled = false;
      } finally {
        sendCodeText.hidden = false;
        sendCodeLoading.hidden = true;
      }
    }

    async function submitClaim() {
      var qq = qqInput.value.trim();
      var name = nameInput.value.trim();
      var school = schoolInput.value.trim();
      var link = normalizeQqLink(linkInput.value);
      var code = codeInput.value.trim();
      var captchaCode = captchaInput ? captchaInput.value.trim() : '';

      if (!qq) { qqInput.focus(); return; }
      if (!name) { nameInput.focus(); return; }
      if (!link) {
        linkInput.focus();
        if (qrStatus) {
          qrStatus.textContent = t('members.linkInvalid');
          qrStatus.style.color = '#ef4444';
        }
        return;
      }
      // 归一化后再回填，用户看到的就是最终会存进数据库的那一条
      linkInput.value = link;
      if (verifyMode === 'email' && !code) { codeInput.focus(); return; }
      if (verifyMode === 'captcha' && !captchaCode) { if (captchaInput) captchaInput.focus(); return; }

      submitBtn.disabled = true;
      submitText.hidden = true;
      submitLoading.hidden = false;

      try {
        var payload = {
          qq: qq,
          qqFriendLink: link,
          displayName: name,
          school: school
        };
        if (verifyMode === 'email') payload.code = code;
        if (verifyMode === 'captcha') {
          payload.captchaChallengeId = captchaChallengeId;
          payload.captchaCode = captchaCode;
        }

        var resp = await fetch(CLAIM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        var data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.detail || data.message || t('claim.submitFailed'));
        }

        // 后端会区分「直接生效」与「待审核」，文案由它给出，前端不再另写一套。
        var messageEl = successBox.querySelector('[data-claim-success-message]');
        if (messageEl && data && data.message) {
          messageEl.textContent = data.message;
        }
        // 提交成功后立刻把入口按钮置为已提交，避免用户关掉弹窗后对着
        // 仍是「待补全」的卡片重复提交。
        if (currentButton) {
          currentButton.disabled = true;
          currentButton.textContent = t('members.submitted');
        }
        claimed = true;

        step1.hidden = true;
        step2.hidden = false;
        successBox.hidden = false;
        errorBox.hidden = true;
      } catch (err) {
        step1.hidden = true;
        step2.hidden = false;
        successBox.hidden = true;
        errorBox.hidden = false;
        errorMsg.textContent = err.message || t('claim.submitFailedRetry');
        retryBtn.hidden = false;
        // 图形验证码一次性有效，失败后必须换一张
        if (verifyMode === 'captcha') loadCaptcha();
      } finally {
        submitBtn.disabled = false;
        submitText.hidden = false;
        submitLoading.hidden = true;
      }
    }

    openBtns.forEach(function(btn) {
      btn.addEventListener('click', function() { openModal(btn); });
    });
    closeBtns.forEach(function(btn) { btn.addEventListener('click', closeModal); });
    sendCodeBtn.addEventListener('click', sendCode);
    submitBtn.addEventListener('click', submitClaim);
    retryBtn.addEventListener('click', function() {
      resetForm();
    });

    // 二维码上传：识别成功后直接填入链接输入框
    var qrUploadBtn = modal.querySelector('[data-qr-upload-btn]');
    var qrInput = modal.querySelector('[data-qr-input]');
    var qrStatus = modal.querySelector('[data-qr-status]');

    if (qrUploadBtn && qrInput) {
      qrUploadBtn.addEventListener('click', function() { qrInput.click(); });
      qrInput.addEventListener('change', async function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;

        qrStatus.textContent = t('members.qrParsing');
        qrStatus.style.color = '';

        try {
          var decoded = await decodeQrFromFile(file);
          var normalized = normalizeQqLink(decoded);
          if (normalized) {
            linkInput.value = normalized;
            qrStatus.textContent = t('members.qrSuccess');
            qrStatus.style.color = '#10b981';
          } else if (decoded) {
            qrStatus.textContent = t('members.qrNotQq');
            qrStatus.style.color = '#ef4444';
          } else {
            qrStatus.textContent = t('members.qrNoCode');
            qrStatus.style.color = '#ef4444';
          }
        } catch (error) {
          qrStatus.textContent = t('members.qrRetry');
          qrStatus.style.color = '#ef4444';
        } finally {
          qrInput.value = '';
          setTimeout(function() { qrStatus.textContent = ''; }, 4000);
        }
      });
    }

    modal.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !step1.hidden && document.activeElement !== submitBtn
          && document.activeElement !== sendCodeBtn) {
        e.preventDefault();
        submitClaim();
      }
    });
  }

  /** 工牌深链参数读一次就用 replaceState 抹掉，刷新或转发都不会再弹一次。 */
  function badgeDeepLink() {
    var params = new URLSearchParams(window.location.search);
    var badgeId = params.get('badge') || '';
    if (!badgeId) return '';
    params.delete('badge');
    var query = params.toString();
    window.history.replaceState({}, '', window.location.pathname +
      (query ? '?' + query : '') + window.location.hash);
    return badgeId;
  }

  function init() {
    var cards = Array.from(document.querySelectorAll('.member-card'));
    var badgeId = badgeDeepLink();
    var network = initMemberNetwork();
    var filters = initMemberFilters(cards, function(matched) { network.setCards(matched); });
    initMemberOverview(cards);
    initMemberBadge({ network: network, filters: filters, badgeId: badgeId });
    initMemberQrPopups();
    initClaimModal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
