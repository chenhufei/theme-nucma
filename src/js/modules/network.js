import { t } from './i18n.js';
/**
 * 成员关系网（原「成员星球」）。
 *
 * 这里不再有球体：成员是漂浮在平面上的节点，位置、大小、层级（z）与漂移方向
 * 全部随机生成，节点之间用学校关联线连起来，整体像一张会呼吸的关系网，
 * 而不是一颗绕轴自转的星球。
 *
 * 交互约定：
 * - 拖动 = 平移整张网（不是转球），松手后带一点惯性滑行。
 * - 鼠标移到关联线上 = 显示「谁和谁 · 哪类关联 · 多强 · 为什么」。
 * - 方向键 = 平移；回车 = 打开当前命中的成员。
 * - 尊重 prefers-reduced-motion：不漂移、无惯性，画面静止。
 *
 * 性能约束：
 * - 每帧复用投影结果与绘制顺序数组，不在渲染循环里新建坐标对象。
 * - 头像按 URL 缓存并做 LRU 淘汰，成员多时不会无限增长。
 * - 不在视口内或标签页隐藏时停止 rAF。
 */

var TAU = Math.PI * 2;

var MAX_NODES = 140;
var AVATAR_LIMIT = 160;

// 节点在"视野归一化坐标"里的活动范围：1 = 整个视野宽/高
var FIELD_RADIUS = 0.46;
var FIELD_WIDE = 1.18;
// 越界多少才回卷，避免节点在边缘突然消失
var FIELD_MARGIN = 0.12;

// 平移边界：最多拖走视野的这个比例，防止把整张网拖出画布
var PAN_LIMIT = 0.34;
var PAN_DECAY = 0.9;

// 节点直径相对视野短边的比例区间
var NODE_MIN_RATIO = 0.016;
var NODE_MAX_RATIO = 0.036;

var REVEAL_DURATION = 520;
var REVEAL_STAGGER = 8;

var DEFAULT_ACCENT = '209,62,67';
// 学校关联数据由 PluginMembers 提供（服务端调用 AI Foundation 分析）
var AFFINITY_ENDPOINT = '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers/school-affinity';
var FONT_STACK = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

// 关联线的最小可见透明度：强度归一化后仍保留一点存在感
var LINK_MIN_ALPHA = 0.14;
var CURVE_SAMPLES = 14;

function clamp(value, min, max) {
  return value < min ? min : (value > max ? max : value);
}

// 带一点回弹的出场曲线，节点"蹦"出来的手感更接近系统动画
function easeOutBack(t) {
  var c1 = 1.70158;
  var c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function byDepth(a, b) {
  return a.z - b.z;
}

/**
 * 随机布局：位置、大小、层级、漂移方向都随机。
 *
 * 位置用"圆盘内均匀采样 + 少量外围散点"，并做最小间距重试，
 * 否则纯随机会出现几个头像叠在一起看不清。重试失败就直接落点，
 * 不能为了美观把成员数量砍掉。
 */
function buildLayout(total) {
  var positions = [];
  if (total <= 0) {
    return positions;
  }
  var minGap = total > 60 ? 0.055 : 0.085;
  for (var i = 0; i < total; i++) {
    var placed = null;
    for (var attempt = 0; attempt < 32; attempt++) {
      // 70% 落在主体圆盘内，30% 散到外围，看起来像星系的核球 + 旋臂
      var inner = Math.random() < 0.7;
      var radius = Math.sqrt(Math.random()) * (inner ? 0.34 : FIELD_RADIUS);
      var angle = Math.random() * TAU;
      var candidate = {
        x: Math.cos(angle) * radius * FIELD_WIDE,
        y: Math.sin(angle) * radius
      };
      var ok = true;
      for (var j = 0; j < positions.length; j++) {
        var dx = positions[j].x - candidate.x;
        var dy = positions[j].y - candidate.y;
        if (dx * dx + dy * dy < minGap * minGap) {
          ok = false;
          break;
        }
      }
      if (ok) {
        placed = candidate;
        break;
      }
    }
    if (!placed) {
      placed = {
        x: (Math.random() * 2 - 1) * FIELD_RADIUS * FIELD_WIDE,
        y: (Math.random() * 2 - 1) * FIELD_RADIUS
      };
    }
    // z 只影响大小与层级（近大远小、近实远虚），不参与任何旋转
    var z = Math.random() * 2 - 1;
    // 漂移：方向完全随机，速度随深度略微变化（远处更慢，形成视差）
    var speed = (0.004 + Math.random() * 0.012) * (0.6 + (z + 1) * 0.35);
    var drift = Math.random() * TAU;
    positions.push({
      x: placed.x,
      y: placed.y,
      z: z,
      size: NODE_MIN_RATIO + Math.random() * (NODE_MAX_RATIO - NODE_MIN_RATIO),
      vx: Math.cos(drift) * speed,
      vy: Math.sin(drift) * speed
    });
  }
  return positions;
}

export function createMemberNetwork(options) {
  var section = options.section;
  var canvas = options.canvas;
  if (!section || !canvas || !canvas.getContext) {
    return createNoopNetwork();
  }

  var ctx = canvas.getContext('2d');
  var tip = options.tip || null;
  var countEl = options.countEl || null;
  var listEl = options.listEl || null;
  var container = options.container || null;
  var buttons = options.buttons || [];
  var affinityEl = options.affinityEl || null;
  var linkTipEl = options.linkTipEl || null;
  var affinityConf = options.affinity || {};
  var affinityEnabled = affinityConf.enabled !== false;
  var affinityMinStrength = typeof affinityConf.minStrength === 'number'
    ? affinityConf.minStrength : 0;
  var affinityShowReason = affinityConf.showReason !== false;

  // 显示方式记忆：后台可配默认值，用户手动切换后写进 localStorage
  var storageKey = options.storageKey || 'nucma:members:view';
  var defaultMode = options.defaultMode === 'network' ? 'network' : 'grid';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  var nodes = [];
  var drawOrder = [];
  var affinityLinks = [];
  var affinityLoaded = false;
  var linkPaths = [];
  var hoveredLink = null;
  var affinityMeta = null;
  var affinityReason = '';
  var signature = '';
  var accent = readAccent();
  var avatarCache = new Map();

  var active = false;
  var inView = true;
  var width = 0;
  var height = 0;

  // 平移量（像素）与惯性速度（像素/毫秒）
  var panX = 0;
  var panY = 0;
  var panVX = 0;
  var panVY = 0;

  var revealAt = 0;
  var projected = { x: 0, y: 0 };

  var pointer = { x: -1, y: -1, inside: false, dragging: false, moved: 0, lastX: 0, lastY: 0, id: null };
  var hovered = null;
  var focused = null;
  var needsDraw = false;
  var frame = null;
  var lastTime = 0;
  var listeners = [];

  function now() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  function readAccent() {
    var style = getComputedStyle(document.documentElement);
    var raw = (style.getPropertyValue('--primary-rgb') || '').replace(/\s+/g, '');
    return /^\d+,\d+,\d+$/.test(raw) ? raw : DEFAULT_ACCENT;
  }

  function prefersReducedMotion() {
    return reduceMotion ? reduceMotion.matches : false;
  }

  function readStoredMode() {
    try {
      var value = window.localStorage.getItem(storageKey);
      if (value === 'network' || value === 'globe') {
        return 'network';
      }
      return value === 'grid' ? 'grid' : '';
    } catch (error) {
      return '';
    }
  }

  function storeMode(mode) {
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch (error) {
      // 隐私模式下写不进去，不影响当前会话
    }
  }

  function loadAvatar(url) {
    var cached = avatarCache.get(url);
    if (cached) {
      avatarCache.delete(url);
      avatarCache.set(url, cached);
      return cached;
    }
    var entry = { image: new Image(), ready: false };
    entry.image.decoding = 'async';
    entry.image.onload = function() {
      entry.ready = entry.image.naturalWidth > 0;
      requestDraw();
    };
    entry.image.onerror = function() {
      entry.ready = false;
      avatarCache.delete(url);
    };
    entry.image.src = url;
    avatarCache.set(url, entry);
    if (avatarCache.size > AVATAR_LIMIT) {
      avatarCache.delete(avatarCache.keys().next().value);
    }
    return entry;
  }

  function signatureOf(list) {
    var parts = [];
    for (var i = 0; i < list.length; i++) {
      var name = list[i].querySelector('.member-name');
      var img = list[i].querySelector('.member-avatar img');
      parts.push(
        (name ? (name.textContent || '').trim() : '')
        + '#' + (img ? img.getAttribute('src') || '' : '')
        + '#' + (list[i].getAttribute('data-group') || '')
      );
    }
    return list.length + ':' + parts.join('|');
  }

  function readNode(card, position, index) {
    var nameEl = card.querySelector('.member-name');
    var name = nameEl ? (nameEl.textContent || '').trim() : '';
    var img = card.querySelector('.member-avatar img');
    var src = img ? img.getAttribute('src') || '' : '';
    var slot = card.closest ? card.closest('.member-card-slot') : null;
    var group = card.getAttribute('data-group') || '';
    var school = (card.getAttribute('data-school') || '').trim();
    return {
      card: card,
      trigger: slot ? slot.querySelector('[data-member-preview]') : null,
      name: name || t('members.labelMembers'),
      initial: (name || t('network.member')).slice(0, 1),
      group: group,
      school: school,
      avatar: src ? loadAvatar(src) : null,
      x: position.x,
      y: position.y,
      z: position.z,
      vx: position.vx,
      vy: position.vy,
      size: position.size,
      sx: 0,
      sy: 0,
      depth: 0,
      radius: 0,
      alpha: 1,
      scale: 1,
      hoverEase: 0,
      delay: index * REVEAL_STAGGER
    };
  }

  function buildNodes(list) {
    var picked = list;
    if (list.length > MAX_NODES) {
      picked = [];
      var step = list.length / MAX_NODES;
      for (var i = 0; i < MAX_NODES; i++) {
        picked.push(list[Math.floor(i * step)]);
      }
    }
    var layout = buildLayout(picked.length);
    nodes = [];
    for (var j = 0; j < picked.length; j++) {
      nodes.push(readNode(picked[j], layout[j], j));
    }
    drawOrder.length = picked.length;
    hovered = null;
    focused = null;
    hoveredLink = null;
    linkPaths.length = 0;
    hideLinkTip();
    panX = 0;
    panY = 0;
    panVX = 0;
    panVY = 0;
    revealAt = prefersReducedMotion() ? 0 : now();
    loadAffinity();
  }

  var AFFINITY_CATEGORY_LABELS = {
    cooperation: t('network.partner'),
    region: t('network.region'),
    organization: t('network.smallOrg')
  };

  function strengthLabel(value) {
    if (value >= 0.7) {
      return t('network.strong');
    }
    if (value >= 0.45) {
      return t('network.medium');
    }
    return t('network.weak');
  }

  /** 关联强度归一：缺失或非法值按 0.3 处理，避免 NaN 传进 canvas */
  function normalizedStrength(link) {
    var value = link && typeof link.strength === 'number' ? link.strength : 0.3;
    return clamp(value, 0, 1);
  }

  /**
   * 关联依据面板：把「分析了什么、凭什么连这条线」摊开给读者。
   * 关闭主题设置里的「显示分析依据」时整块不渲染。
   */
  function renderAffinityPanel() {
    if (!affinityEl || !affinityShowReason) {
      return;
    }
    while (affinityEl.firstChild) {
      affinityEl.removeChild(affinityEl.firstChild);
    }
    if (!affinityEnabled || affinityReason === 'disabled-by-admin'
      || affinityReason === 'ai-unavailable') {
      affinityEl.hidden = true;
      return;
    }

    affinityEl.hidden = false;
    var meta = affinityMeta || {};
    var aspects = Array.isArray(meta.aspects) ? meta.aspects : [];
    var aspectText = aspects.map(function(key) {
      return AFFINITY_CATEGORY_LABELS[key] || key;
    }).join(' · ');

    var head = document.createElement('div');
    head.className = 'member-network-affinity-head';
    var title = document.createElement('strong');
    title.textContent = t('network.aiAnalysis');
    head.appendChild(title);
    var summary = document.createElement('span');
    summary.textContent = (meta.schoolCount ? t('network.schools', meta.schoolCount) : t('network.schoolsInAnalysis'))
      + (aspectText ? ' · ' + aspectText : '')
      + ' · ' + (affinityLinks.length ? t('network.groups', affinityLinks.length) : t('network.noLink'));
    head.appendChild(summary);
    affinityEl.appendChild(head);

    if (!affinityLinks.length) {
      var empty = document.createElement('p');
      empty.className = 'member-network-affinity-empty';
      empty.textContent = affinityReason === 'not-enough-schools'
        ? t('network.tooFewSchools')
        : t('network.noPair');
      affinityEl.appendChild(empty);
      return;
    }

    var list = document.createElement('ul');
    list.className = 'member-network-affinity-list';
    affinityLinks.slice(0, 8).forEach(function(link) {
      var item = document.createElement('li');
      var pair = document.createElement('span');
      pair.className = 'member-network-affinity-pair';
      pair.textContent = link.a + ' ↔ ' + link.b;
      item.appendChild(pair);

      var tag = document.createElement('em');
      tag.className = 'member-network-affinity-tag';
      tag.textContent = (AFFINITY_CATEGORY_LABELS[link.category] || t('network.linkFallback'))
        + ' · ' + strengthLabel(normalizedStrength(link));
      item.appendChild(tag);

      if (link.reason) {
        var why = document.createElement('span');
        why.className = 'member-network-affinity-reason';
        why.textContent = link.reason;
        item.appendChild(why);
      }
      list.appendChild(item);
    });
    affinityEl.appendChild(list);

    if (affinityLinks.length > 8) {
      var more = document.createElement('p');
      more.className = 'member-network-affinity-empty';
      more.textContent = t('network.omitted', affinityLinks.length - 8);
      affinityEl.appendChild(more);
    }
  }

  /**
   * 拉取学校关联数据。AI 分析成本较高，服务端有缓存，前端只请求一次。
   */
  function loadAffinity() {
    if (affinityLoaded) {
      return;
    }
    if (!affinityEnabled) {
      affinityLoaded = true;
      return;
    }
    var seen = {};
    var schools = [];
    for (var i = 0; i < nodes.length; i++) {
      var school = nodes[i].school;
      if (school && !seen[school]) {
        seen[school] = 1;
        schools.push(school);
      }
    }
    if (schools.length < 2) {
      return;
    }
    affinityLoaded = true;
    fetch(AFFINITY_ENDPOINT, { headers: { 'Accept': 'application/json' } })
      .then(function(resp) { return resp.ok ? resp.json() : null; })
      .then(function(data) {
        if (!data) {
          return;
        }
        affinityMeta = data.meta || null;
        affinityReason = data.reason || '';
        var links = Array.isArray(data.links) ? data.links : [];
        affinityLinks = links.filter(function(link) {
          if (!link || !link.a || !link.b || link.a === link.b) {
            return false;
          }
          return normalizedStrength(link) >= affinityMinStrength;
        });
        renderAffinityPanel();
        requestDraw();
      })
      .catch(function() {
        affinityLinks = [];
      });
  }

  function buildFocusList() {
    if (!listEl) {
      return;
    }
    while (listEl.firstChild) {
      listEl.removeChild(listEl.firstChild);
    }
    nodes.forEach(function(node) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'member-network-node-button';
      button.textContent = node.group ? node.name + '（' + node.group + '）' : node.name;
      button.addEventListener('click', function() {
        openNode(node);
      });
      button.addEventListener('focus', function() {
        focused = node;
        renderTip();
        requestDraw();
      });
      button.addEventListener('blur', function() {
        if (focused === node) {
          focused = null;
          hideTip();
          requestDraw();
        }
      });
      item.appendChild(button);
      listEl.appendChild(item);
    });
  }

  function setCards(nextCards) {
    var next = nextCards || [];
    var sig = signatureOf(next);
    if (sig !== signature) {
      signature = sig;
      buildNodes(next);
      buildFocusList();
      hideTip();
    }
    if (countEl) {
      countEl.textContent = t('network.memberCount', next.length);
    }
    requestDraw();
    if (active && !prefersReducedMotion()) {
      schedule();
    }
  }

  /**
   * 世界坐标 → 屏幕坐标。
   *
   * 世界坐标以视野中心为原点、按视野尺寸归一：x∈[-0.6,0.6]、y∈[-0.46,0.46]。
   * z 只缩放与调整透明度（近大远小），不参与旋转——这张网是平的。
   */
  function projectNode(node, centerX, centerY) {
    var scale = 0.72 + (node.z + 1) * 0.2;
    projected.x = centerX + node.x * width + panX;
    projected.y = centerY + node.y * height + panY;
    projected.scale = scale;
    return projected;
  }

  /**
   * 背景：一层极淡的星云径向光晕 + 少量星尘点。
   *
   * 星尘点用节点坐标派生的固定伪随机序列，每帧位置稳定（不闪烁），
   * 只随平移一起移动，用来给"平面"一点纵深提示。
   */
  function drawBackdrop(centerX, centerY) {
    var outer = Math.max(width, height) * 0.62;
    var glow = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, outer);
    glow.addColorStop(0, 'rgba(' + accent + ',0.10)');
    glow.addColorStop(0.55, 'rgba(' + accent + ',0.04)');
    glow.addColorStop(1, 'rgba(' + accent + ',0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, outer, 0, TAU);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.save();
    ctx.fillStyle = 'rgba(' + accent + ',0.16)';
    for (var i = 0; i < dust.length; i += 3) {
      var dx = centerX + dust[i] * width + panX * 0.45;
      var dy = centerY + dust[i + 1] * height + panY * 0.45;
      if (dx < -10 || dy < -10 || dx > width + 10 || dy > height + 10) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(dx, dy, dust[i + 2], 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // 星尘：一次性生成的固定序列，不参与节点布局
  var dust = (function() {
    var list = [];
    for (var i = 0; i < 90; i++) {
      list.push((Math.random() * 2 - 1) * 0.58);
      list.push((Math.random() * 2 - 1) * 0.48);
      list.push(0.4 + Math.random() * 1.1);
    }
    return list;
  })();

  function layoutNodes(centerX, centerY, time) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var point = projectNode(node, centerX, centerY);
      node.sx = point.x;
      node.sy = point.y;
      node.depth = node.z;
      var base = node.size * Math.min(width, height);
      node.radius = base * point.scale;
      node.alpha = 0.42 + 0.58 * ((node.z + 1) / 2);

      var hoverTarget = (node === hovered || node === focused) ? 1 : 0;
      if (prefersReducedMotion()) {
        node.hoverEase = hoverTarget;
      } else {
        node.hoverEase += (hoverTarget - node.hoverEase) * 0.24;
        if (Math.abs(node.hoverEase - hoverTarget) < 0.003) {
          node.hoverEase = hoverTarget;
        }
      }

      var appear = 1;
      if (revealAt) {
        var t = clamp((time - revealAt - node.delay) / REVEAL_DURATION, 0, 1);
        appear = t >= 1 ? 1 : easeOutBack(t);
      }
      node.scale = appear * (1 + node.hoverEase * 0.16);

      drawOrder[i] = node;
    }
    drawOrder.length = nodes.length;
    drawOrder.sort(byDepth);
  }

  function drawNode(node) {
    var radius = node.radius * node.scale;
    // 入场时 scale 从 0 起，半径会经过零点附近；小于 2px 直接跳过，
    // 否则描边用的 radius - 0.8 会算成负数，arc() 会抛 IndexSizeError 中断整帧
    if (!(radius > 2)) {
      return;
    }
    var entry = node.avatar;
    var emphasized = node.hoverEase > 0.5;

    ctx.save();
    ctx.globalAlpha = node.alpha;
    ctx.beginPath();
    ctx.arc(node.sx, node.sy, radius, 0, TAU);
    ctx.clip();

    if (entry && entry.ready) {
      var image = entry.image;
      var size = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(
        image,
        (image.naturalWidth - size) / 2,
        (image.naturalHeight - size) / 2,
        size,
        size,
        node.sx - radius,
        node.sy - radius,
        radius * 2,
        radius * 2
      );
    } else {
      var fill = ctx.createLinearGradient(node.sx - radius, node.sy - radius, node.sx + radius, node.sy + radius);
      fill.addColorStop(0, 'rgba(' + accent + ',0.92)');
      fill.addColorStop(1, 'rgba(' + accent + ',0.62)');
      ctx.fillStyle = fill;
      ctx.fillRect(node.sx - radius, node.sy - radius, radius * 2, radius * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '600 ' + Math.max(9, Math.round(radius * 0.82)) + 'px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.initial, node.sx, node.sy + 1);
    }

    // 远处节点压一层暗纱：不用投影，避免半透明头像糊掉
    if (node.z < 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.2 * -node.z).toFixed(3) + ')';
      ctx.fillRect(node.sx - radius, node.sy - radius, radius * 2, radius * 2);
    }

    // 顶部高光：模拟玻璃球的反射，让头像不显得扁平
    ctx.beginPath();
    ctx.arc(node.sx, node.sy, radius * 0.88, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = 'rgba(255,255,255,' + (node.z >= 0 ? 0.4 : 0.16) + ')';
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = node.alpha;
    ctx.beginPath();
    ctx.arc(node.sx, node.sy, radius - (emphasized ? 1.6 : 0.8), 0, TAU);
    ctx.lineWidth = emphasized ? Math.max(2, radius * 0.14) : Math.max(1, radius * 0.06);
    ctx.strokeStyle = emphasized
      ? 'rgb(' + accent + ')'
      : 'rgba(255,255,255,' + (node.z >= 0 ? 0.6 : 0.28) + ')';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 学校关联连线：线宽与透明度表示关联强弱。
   *
   * 强弱是**相对**的：以当前这批连线里的最大强度做基准归一化，
   * 因此最强的一条永远是画面里最粗最实的一条，其他线自动让位。
   * 每帧把曲线采样点存进 linkPaths，供鼠标命中检测（命中后显示关联原因）。
   */
  function drawAffinity(centerX, centerY) {
    linkPaths.length = 0;
    if (!affinityLinks.length || !nodes.length) {
      return;
    }
    var bySchool = {};
    for (var i = 0; i < nodes.length; i++) {
      var school = nodes[i].school;
      if (school && !bySchool[school]) {
        bySchool[school] = nodes[i];
      }
    }

    var maxStrength = 0;
    for (var m = 0; m < affinityLinks.length; m++) {
      var value = normalizedStrength(affinityLinks[m]);
      if (value > maxStrength) {
        maxStrength = value;
      }
    }
    if (!(maxStrength > 0)) {
      maxStrength = 1;
    }

    for (var k = 0; k < affinityLinks.length; k++) {
      var link = affinityLinks[k];
      var from = bySchool[link.a];
      var to = bySchool[link.b];
      if (!from || !to || from === to) {
        continue;
      }
      linkPaths.push({
        link: link,
        from: from,
        to: to,
        ratio: clamp(normalizedStrength(link) / maxStrength, 0, 1),
        front: (from.z + to.z) / 2 >= 0,
        points: curvePoints(from, to)
      });
    }
    if (!linkPaths.length) {
      return;
    }

    var ordered = linkPaths.slice().sort(function(a, b) {
      if (a.front !== b.front) {
        return a.front ? 1 : -1;
      }
      return a.ratio - b.ratio;
    });

    ctx.save();
    ctx.lineCap = 'round';
    for (var n = 0; n < ordered.length; n++) {
      if (ordered[n] === hoveredLink) {
        continue;
      }
      strokeLink(ordered[n], false);
    }
    if (hoveredLink) {
      strokeLink(hoveredLink, true);
    }
    ctx.restore();
  }

  function strokeLink(item, emphasized) {
    var strength = item.ratio;
    var weight = 0.7 + strength * 4.2;
    if (!item.front) {
      weight *= 0.55;
    }
    if (emphasized) {
      weight = weight * 1.5 + 1.4;
    }
    ctx.globalAlpha = emphasized
      ? 0.95
      : (item.front ? LINK_MIN_ALPHA + strength * 0.6 : LINK_MIN_ALPHA * 0.5 + strength * 0.12);
    ctx.strokeStyle = emphasized
      ? 'rgba(' + accent + ',0.95)'
      : 'rgba(' + accent + ',' + (item.front ? 0.62 : 0.24) + ')';
    ctx.lineWidth = weight;

    var ctrl = curveControl(item.from, item.to);
    ctx.beginPath();
    ctx.moveTo(item.from.sx, item.from.sy);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, item.to.sx, item.to.sy);
    ctx.stroke();

    if (!emphasized) {
      return;
    }
    // 悬停时在两端各点一个小圆：明确指出这条线连的是哪两个头像
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(' + accent + ',0.95)';
    var ends = [item.from, item.to];
    for (var e = 0; e < ends.length; e++) {
      ctx.beginPath();
      ctx.arc(ends[e].sx, ends[e].sy, Math.max(3, ends[e].radius * 0.34), 0, TAU);
      ctx.fill();
    }
  }

  /** 连线略微弯成弧：直线在密集处会与别的线糊成一片，弧线能看出走向 */
  function curveControl(from, to) {
    var midX = (from.sx + to.sx) / 2;
    var midY = (from.sy + to.sy) / 2;
    var dx = to.sx - from.sx;
    var dy = to.sy - from.sy;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    // 沿垂直方向偏移 12%，方向跟着两端位置变化
    var offset = length * 0.12;
    return {
      x: midX - (dy / length) * offset,
      y: midY + (dx / length) * offset
    };
  }

  function curvePoints(from, to) {
    var ctrl = curveControl(from, to);
    var points = [];
    for (var i = 0; i <= CURVE_SAMPLES; i++) {
      var t = i / CURVE_SAMPLES;
      var mt = 1 - t;
      points.push({
        x: mt * mt * from.sx + 2 * mt * t * ctrl.x + t * t * to.sx,
        y: mt * mt * from.sy + 2 * mt * t * ctrl.y + t * t * to.sy
      });
    }
    return points;
  }

  function draw() {
    if (!width || !height) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    var centerX = width / 2;
    var centerY = height / 2;
    var time = now();

    drawBackdrop(centerX, centerY);
    layoutNodes(centerX, centerY, time);
    drawAffinity(centerX, centerY);
    for (var i = 0; i < drawOrder.length; i++) {
      drawNode(drawOrder[i]);
    }

    if (!nodes.length) {
      ctx.fillStyle = 'rgba(' + accent + ',0.55)';
      ctx.font = '500 14px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('network.noMatch'), centerX, centerY);
    }
  }

  function isAnimating(time) {
    if (revealAt && time - revealAt < REVEAL_DURATION + nodes.length * REVEAL_STAGGER) {
      return true;
    }
    for (var i = 0; i < nodes.length; i++) {
      var target = (nodes[i] === hovered || nodes[i] === focused) ? 1 : 0;
      if (Math.abs(nodes[i].hoverEase - target) > 0.01) {
        return true;
      }
    }
    return false;
  }

  function requestDraw() {
    if (frame) {
      needsDraw = true;
      return;
    }
    draw();
  }

  function schedule() {
    if (frame || !active || !inView || document.hidden) {
      return;
    }
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  /**
   * 每帧推进：节点沿自己的方向漂移（越界回卷），平移量按下惯性滑行。
   * 方向完全随机，不存在"绕某根轴转"的概念。
   */
  function tick(time) {
    frame = null;
    var delta = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    var seconds = delta / 1000;

    if (!pointer.dragging) {
      if (Math.abs(panVX) > 0.02 || Math.abs(panVY) > 0.02) {
        panX += panVX * delta;
        panY += panVY * delta;
        panVX *= PAN_DECAY;
        panVY *= PAN_DECAY;
      } else {
        panVX = 0;
        panVY = 0;
      }
      clampPan();
    }

    if (!prefersReducedMotion()) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        node.x += node.vx * seconds;
        node.y += node.vy * seconds;
        var limitX = FIELD_RADIUS * FIELD_WIDE + FIELD_MARGIN;
        var limitY = FIELD_RADIUS + FIELD_MARGIN;
        if (node.x > limitX) {
          node.x = -limitX;
        } else if (node.x < -limitX) {
          node.x = limitX;
        }
        if (node.y > limitY) {
          node.y = -limitY;
        } else if (node.y < -limitY) {
          node.y = limitY;
        }
      }
    }

    needsDraw = false;
    draw();
    schedule();
  }

  function clampPan() {
    var limitX = width * PAN_LIMIT;
    var limitY = height * PAN_LIMIT;
    panX = clamp(panX, -limitX, limitX);
    panY = clamp(panY, -limitY, limitY);
  }

  function findHovered() {
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.z < -0.75) {
        continue;
      }
      var dx = pointer.x - node.sx;
      var dy = pointer.y - node.sy;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var hit = node.radius * node.scale + 4;
      if (distance <= hit && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  function hideTip() {
    if (tip) {
      tip.hidden = true;
    }
  }

  /**
   * 连线命中检测：按折线近似取点到线段的最短距离。
   * 容差随线宽走，否则粗线难点、细线一碰就中，手感是反的。
   */
  function findHoveredLink() {
    if (!linkPaths.length) {
      return null;
    }
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < linkPaths.length; i++) {
      var item = linkPaths[i];
      var tolerance = 6 + item.ratio * 6;
      if (!item.front) {
        tolerance *= 0.6;
      }
      var limit = tolerance * tolerance;
      var points = item.points;
      for (var j = 1; j < points.length; j++) {
        var distance = pointSegmentDistance(
          pointer.x, pointer.y, points[j - 1].x, points[j - 1].y, points[j].x, points[j].y
        );
        if (distance <= limit && distance < bestDistance) {
          bestDistance = distance;
          best = item;
        }
      }
    }
    return best;
  }

  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) {
      var ox = px - x1;
      var oy = py - y1;
      return ox * ox + oy * oy;
    }
    var t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var ex = px - (x1 + t * dx);
    var ey = py - (y1 + t * dy);
    return ex * ex + ey * ey;
  }

  function hideLinkTip() {
    if (linkTipEl) {
      linkTipEl.hidden = true;
    }
  }

  /**
   * 连线提示：把"谁和谁、哪类关联、多强、模型为什么这么判断"摊在鼠标旁边。
   * 这是关系网里最容易被误解为「装饰」的部分，所以理由必须随线一起出现。
   */
  function renderLinkTip() {
    if (!linkTipEl) {
      return;
    }
    if (!hoveredLink) {
      hideLinkTip();
      return;
    }
    var link = hoveredLink.link;
    var strength = normalizedStrength(link);
    while (linkTipEl.firstChild) {
      linkTipEl.removeChild(linkTipEl.firstChild);
    }

    var head = document.createElement('div');
    head.className = 'member-network-link-tip-head';
    var pair = document.createElement('strong');
    pair.textContent = link.a + ' ↔ ' + link.b;
    head.appendChild(pair);
    var tag = document.createElement('em');
    tag.textContent = (AFFINITY_CATEGORY_LABELS[link.category] || t('network.linkFallback'))
      + ' · ' + strengthLabel(strength);
    head.appendChild(tag);
    linkTipEl.appendChild(head);

    var note = document.createElement('p');
    note.className = 'member-network-link-tip-reason';
    note.textContent = link.reason
      ? link.reason
      : (affinityReason === 'ai-unavailable'
        ? t('network.aiOffline')
        : t('network.noDetail'));
    linkTipEl.appendChild(note);

    linkTipEl.hidden = false;
    positionFloating(linkTipEl);
  }

  /** 浮层跟随鼠标，并夹在区块可视范围内，避免贴边溢出 */
  function positionFloating(element) {
    var canvasRect = canvas.getBoundingClientRect();
    var sectionRect = section.getBoundingClientRect();
    var left = (canvasRect.left - sectionRect.left) + pointer.x + 14;
    var top = (canvasRect.top - sectionRect.top) + pointer.y + 16;
    var maxLeft = section.clientWidth - element.offsetWidth - 10;
    var maxTop = section.clientHeight - element.offsetHeight - 10;
    element.style.left = clamp(left, 10, Math.max(10, maxLeft)) + 'px';
    element.style.top = clamp(top, 10, Math.max(10, maxTop)) + 'px';
  }

  function renderTip() {
    if (!tip) {
      return;
    }
    var target = hovered || focused;
    if (!target || !target.name) {
      hideTip();
      return;
    }
    tip.textContent = target.group ? target.name + ' · ' + target.group : target.name;
    tip.hidden = false;
    var canvasRect = canvas.getBoundingClientRect();
    var sectionRect = section.getBoundingClientRect();
    var left = (canvasRect.left - sectionRect.left) + target.sx;
    var top = (canvasRect.top - sectionRect.top) + target.sy;
    var maxLeft = section.clientWidth - tip.offsetWidth - 8;
    tip.style.left = clamp(left - tip.offsetWidth / 2, 8, Math.max(8, maxLeft)) + 'px';
    tip.style.top = Math.max(4, top - tip.offsetHeight - 12 - target.radius) + 'px';
  }

  function openNode(node) {
    if (!node) {
      return;
    }
    if (node.trigger) {
      node.trigger.click();
      return;
    }
    if (node.card.tagName === 'A' && node.card.href) {
      window.open(node.card.href, '_blank', 'noopener');
    }
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    var nextDpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(width * nextDpr);
    canvas.height = Math.round(height * nextDpr);
    ctx.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
    clampPan();
    requestDraw();
  }

  function setMode(mode, persist) {
    var network = mode === 'network' || mode === 'globe';
    if (network === active) {
      return;
    }
    active = network;
    if (persist) {
      storeMode(network ? 'network' : 'grid');
    }
    section.hidden = !network;
    if (container) {
      container.classList.toggle('is-network-view', network);
    }
    buttons.forEach(function(button) {
      var selected = (button.getAttribute('data-member-view') === 'network') === network;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    if (network) {
      canvas.setAttribute('aria-label', describeNetwork());
      resize();
      replayEnter(section, 'is-entering');
      if (!prefersReducedMotion()) {
        revealAt = now();
        schedule();
      }
    } else {
      stopLoop();
      hovered = null;
      focused = null;
      hoveredLink = null;
      hideTip();
      hideLinkTip();
      replayEnter(container, 'is-grid-entering');
    }
  }

  /**
   * 视图切换的入场动效：加一次性 class 触发 CSS animation，结束即移除。
   * 移除是必须的——否则第二次切换时 class 已存在，动画不会重播。
   */
  function replayEnter(element, className) {
    if (!element || prefersReducedMotion()) {
      return;
    }
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(function() {
      element.classList.remove(className);
    }, 460);
  }

  function describeNetwork() {
    return t('network.ariaSummary', nodes.length) + t('network.ariaHint');
  }

  function on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    listeners.push(function() {
      target.removeEventListener(type, handler, opts);
    });
  }

  function localPoint(event) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  }

  on(canvas, 'pointerdown', function(event) {
    pointer.dragging = true;
    pointer.moved = 0;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.id = event.pointerId;
    panVX = 0;
    panVY = 0;
    localPoint(event);
    pointer.inside = true;
    hideTip();
    hideLinkTip();
    hoveredLink = null;
    canvas.style.cursor = 'grabbing';
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // 捕获失败不影响拖动，pointermove 仍在 canvas 上生效
    }
    schedule();
  });

  on(canvas, 'pointermove', function(event) {
    localPoint(event);
    pointer.inside = true;
    if (!pointer.dragging) {
      // 连线优先于头像：指着线问"为什么连"比指着头像更少见，命中时要先讲清楚
      var nextLink = findHoveredLink();
      if (nextLink !== hoveredLink) {
        hoveredLink = nextLink;
        renderLinkTip();
        if (nextLink) {
          hovered = null;
          hideTip();
        }
        requestDraw();
        makeSureAnimating();
        if (nextLink) {
          canvas.style.cursor = 'help';
          return;
        }
      } else if (nextLink) {
        positionFloating(linkTipEl);
        return;
      }
      var next = findHovered();
      if (next !== hovered) {
        hovered = next;
        canvas.style.cursor = next ? 'pointer' : 'grab';
        renderTip();
        requestDraw();
        makeSureAnimating();
      }
      return;
    }
    var dx = event.clientX - pointer.lastX;
    var dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    // 平面平移：整张网跟着手走，不做任何旋转
    panX += dx;
    panY += dy;
    clampPan();
    panVX = dx * 0.0016;
    panVY = dy * 0.0016;
    requestDraw();
  });

  function endDrag(event, cancelled) {
    if (!pointer.dragging) {
      return;
    }
    pointer.dragging = false;
    canvas.style.cursor = 'grab';
    if (pointer.id !== null) {
      try {
        canvas.releasePointerCapture(pointer.id);
      } catch (error) {
        // 指针可能已经释放
      }
      pointer.id = null;
    }
    if (!cancelled && pointer.moved < 8) {
      localPoint(event);
      openNode(findHovered());
    }
    if (prefersReducedMotion()) {
      panVX = 0;
      panVY = 0;
      stopLoop();
      requestDraw();
    }
  }

  function makeSureAnimating() {
    if (!prefersReducedMotion() && active && inView) {
      schedule();
    }
  }

  on(canvas, 'pointerup', function(event) {
    endDrag(event, false);
  });
  on(canvas, 'pointercancel', function(event) {
    endDrag(event, true);
  });
  on(canvas, 'pointerleave', function() {
    if (pointer.dragging) {
      return;
    }
    pointer.inside = false;
    hovered = null;
    hoveredLink = null;
    canvas.style.cursor = 'grab';
    hideTip();
    hideLinkTip();
    requestDraw();
    makeSureAnimating();
  });

  on(canvas, 'keydown', function(event) {
    var step = 28;
    if (event.key === 'ArrowLeft') {
      panX -= step;
    } else if (event.key === 'ArrowRight') {
      panX += step;
    } else if (event.key === 'ArrowUp') {
      panY -= step;
    } else if (event.key === 'ArrowDown') {
      panY += step;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openNode(hovered || focused || nodes[0]);
      return;
    } else {
      return;
    }
    event.preventDefault();
    clampPan();
    requestDraw();
    makeSureAnimating();
  });

  on(canvas, 'focus', function() {
    canvas.setAttribute('aria-label', describeNetwork());
  });

  buttons.forEach(function(button) {
    on(button, 'click', function() {
      setMode(button.getAttribute('data-member-view') || 'grid', true);
    });
  });

  if ('ResizeObserver' in window) {
    var resizeObserver = new ResizeObserver(function() {
      if (active) {
        resize();
      }
    });
    resizeObserver.observe(section);
    listeners.push(function() {
      resizeObserver.disconnect();
    });
  } else {
    on(window, 'resize', function() {
      if (active) {
        resize();
      }
    });
  }

  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        inView = entry.isIntersecting;
        if (inView && active && !prefersReducedMotion()) {
          schedule();
        } else if (!inView) {
          stopLoop();
        }
      });
    }, { rootMargin: '120px 0px' });
    visibilityObserver.observe(section);
    listeners.push(function() {
      visibilityObserver.disconnect();
    });
  }

  on(document, 'visibilitychange', function() {
    if (document.hidden) {
      stopLoop();
    } else if (active && !prefersReducedMotion()) {
      schedule();
    }
  });

  if (reduceMotion && reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', function() {
      if (active && !prefersReducedMotion()) {
        schedule();
      } else if (prefersReducedMotion()) {
        stopLoop();
        requestDraw();
      }
    });
  }

  if (window.MutationObserver) {
    var themeObserver = new MutationObserver(function() {
      accent = readAccent();
      requestDraw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });
    listeners.push(function() {
      themeObserver.disconnect();
    });
  }

  // 初始显示方式：用户上次的选择优先，其次后台默认值
  setMode(readStoredMode() || defaultMode);

  return {
    setCards: setCards,
    setMode: setMode,
    resize: resize,
    destroy: function() {
      stopLoop();
      listeners.forEach(function(off) {
        off();
      });
      listeners = [];
    }
  };
}

function createNoopNetwork() {
  return {
    setCards: function() {},
    setMode: function() {},
    resize: function() {},
    destroy: function() {}
  };
}
