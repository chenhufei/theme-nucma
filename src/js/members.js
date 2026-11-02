/**
 * 成员页专用交互。较大的拼音与二维码依赖通过本地分包按需加载，
 * 避免成员页打开阶段等待外部 CDN，也避免增加全站主脚本体积。
 */
import { t } from './modules/i18n.js';
import { defaultQqAvatar } from './modules/avatar.js';
import { createMemberNetwork } from './modules/network.js';
import { normalizeQqLink, decodeQrFromFile } from './modules/qq-link.js';

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

  function initMemberPreview() {
    var triggers = Array.from(document.querySelectorAll('[data-member-preview]'));
    if (!triggers.length) return;

    var modal = document.createElement('div');
    modal.className = 'member-preview';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="member-preview-backdrop" data-member-preview-close></div>' +
      '<div class="member-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="memberPreviewName">' +
        '<button type="button" class="member-preview-close" data-member-preview-close aria-label="' + t('members.closePreview') + '">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<path d="M6 6l12 12M18 6L6 18"></path>' +
          '</svg>' +
        '</button>' +
        '<div class="member-preview-header">' +
          '<div class="member-preview-avatar" data-member-preview-avatar></div>' +
          '<div class="member-preview-title">' +
            '<h2 class="member-preview-name" id="memberPreviewName" data-member-preview-name></h2>' +
            '<p class="member-preview-school" data-member-preview-school></p>' +
          '</div>' +
        '</div>' +
        '<dl class="member-preview-meta">' +
          '<div><dt>' + t('members.previewGroup') + '</dt><dd data-member-preview-group></dd></div>' +
          '<div><dt>' + t('members.previewJoined') + '</dt><dd data-member-preview-joined></dd></div>' +
          '<div><dt>' + t('members.previewQq') + '</dt><dd data-member-preview-qq></dd></div>' +
        '</dl>' +
        '<div class="member-preview-qr" data-member-preview-qr hidden>' +
          '<canvas data-member-preview-canvas width="180" height="180" role="img" aria-label="' + t('members.previewQrLabel') + '"></canvas>' +
          '<span class="member-preview-qr-status" data-member-preview-qr-status>' + t('members.previewQrPending') + '</span>' +
        '</div>' +
        '<div class="member-preview-actions">' +
          '<a class="btn btn-primary btn-sm" data-member-preview-link target="_blank" rel="noopener noreferrer" hidden>' + t('members.previewAdd') + '</a>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-member-preview-close>' + t('members.previewClose') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var dialog = modal.querySelector('.member-preview-dialog');
    var closeButton = modal.querySelector('.member-preview-close');
    var lastFocus = null;

    function close() {
      modal.hidden = true;
      document.documentElement.classList.remove('member-preview-open');
      var canvas = modal.querySelector('[data-member-preview-canvas]');
      if (canvas) {
        var ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        delete canvas.dataset.qrFor;
      }
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
    }

    function renderQr(link) {
      var wrap = modal.querySelector('[data-member-preview-qr]');
      var canvas = modal.querySelector('[data-member-preview-canvas]');
      var status = modal.querySelector('[data-member-preview-qr-status]');
      if (!wrap || !canvas || !link) return;
      wrap.hidden = false;
      if (canvas.dataset.qrFor === link) return;
      canvas.dataset.qrFor = link;
      status.textContent = t('members.generating');
      loadQrCode().then(function(QRCode) {
        return QRCode.toCanvas(canvas, link, {
          width: 360,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827FF', light: '#FFFFFFFF' }
        });
      }).then(function() {
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        status.textContent = t('members.qrScan');
      }).catch(function() {
        delete canvas.dataset.qrFor;
        wrap.hidden = true;
      });
    }

    function open(card, trigger) {
      lastFocus = trigger || document.activeElement;
      var nameEl = card.querySelector('.member-name');
      var avatarEl = card.querySelector('.member-avatar img');
      var school = (card.getAttribute('data-school') || '').trim();
      var group = (card.getAttribute('data-group') || '').trim();
      var qq = (card.getAttribute('data-qq') || '').trim();
      var link = '';
      if (card.tagName === 'A') link = card.getAttribute('href') || '';
      else {
        var canvasEl = card.querySelector('[data-qr-text]');
        if (canvasEl) link = canvasEl.getAttribute('data-qr-text') || '';
      }
      var created = cardDate(card);
      var name = nameEl ? nameEl.textContent.trim() : t('members.labelMembers');

      modal.querySelector('[data-member-preview-name]').textContent = name;
      modal.querySelector('[data-member-preview-school]').textContent = school || t('members.noSchool');
      modal.querySelector('[data-member-preview-group]').textContent = group || t('members.ungrouped');
      modal.querySelector('[data-member-preview-joined]').textContent =
        created ? formatDate(created) + '（' + relativeDays(created) + '）' : t('members.unknown');
      modal.querySelector('[data-member-preview-qq]').textContent = qq || t('members.isPrivate');

      var avatarBox = modal.querySelector('[data-member-preview-avatar]');
      avatarBox.textContent = '';
      if (avatarEl && avatarEl.getAttribute('src')) {
        var img = document.createElement('img');
        img.src = avatarEl.getAttribute('src');
        img.alt = name;
        img.loading = 'lazy';
        avatarBox.appendChild(img);
      } else {
        avatarBox.textContent = name.slice(0, 1);
        avatarBox.classList.add('is-fallback');
      }

      var linkEl = modal.querySelector('[data-member-preview-link]');
      if (link) {
        linkEl.href = link;
        linkEl.hidden = false;
        renderQr(link);
      } else {
        linkEl.removeAttribute('href');
        linkEl.hidden = true;
        modal.querySelector('[data-member-preview-qr]').hidden = true;
      }

      modal.hidden = false;
      document.documentElement.classList.add('member-preview-open');
      closeButton.focus();
    }

    modal.querySelectorAll('[data-member-preview-close]').forEach(function(el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function(event) {
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusable = Array.from(dialog.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])'))
        .filter(function(el) { return !el.hidden && el.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    triggers.forEach(function(trigger) {
      var card = trigger.closest('.member-card-slot')?.querySelector('.member-card');
      if (!card) return;
      trigger.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        open(card, trigger);
      });
    });
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
          throw new Error(data.message || t('members.sendFailed'));
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
          throw new Error(data.message || t('claim.submitFailed'));
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

  function init() {
    var cards = Array.from(document.querySelectorAll('.member-card'));
    var network = initMemberNetwork();
    initMemberFilters(cards, function(matched) { network.setCards(matched); });
    initMemberOverview(cards);
    initMemberPreview();
    initMemberQrPopups();
    initClaimModal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
