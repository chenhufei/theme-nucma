import { t } from './i18n.js';
/**
 * 成员关系星图（3D 星云关系网）。
 *
 * 视觉参照「诗云星图」这类 3D 关系星图：
 * - 节点只有成员头像，不再画「学校 / 分组」这一层，避免学校名抢走注意力；
 * - 每个头像的光晕取该头像的主色调（跨域头像走成员插件的同源头像代理，画布才读得到像素）；
 * - 连线是极细的彩色纤维，带流动光点，形成"星云纤维"的质感；
 * - 整张图绕 Y 轴缓慢自转，可拖动旋转、滚轮缩放；
 * - 头像下方的小字是成员名称，不是学校。
 *
 * 交互约定：
 * - 第一次点头像 = 以该成员为中心重排，亮起他的关系网（其余头像外推压暗）；
 * - 再点同一个头像 = 打开他的工作证（复用成员卡上的详情按钮）；
 * - 点空白处 / 「重置视角」 = 退出聚焦，回到全员星图；
 * - 拖动 = 旋转视角（不是平移）；滚轮 = 缩放；方向键 = 旋转；回车 = 同点击。
 *
 * 关系数据（按优先级，前一层不可用才退到下一层）：
 * 1. 插件的大模型成员关系接口 member-affinity（若插件提供）；
 * 2. 插件的 school-affinity（AI 分析学校关联），把学校关联映射到成员之间；
 * 3. 本地结构关系：同校 → 同组。这一层只保证图不空，界面上会标明来源。
 *
 * 性能约束：
 * - 每帧复用投影结果，不在渲染循环里新建大量对象；
 * - 辉光用离屏精灵，避免每帧 createRadialGradient；
 * - 头像按 URL 缓存，取色只做一次（20×20 采样）；
 * - 不在视口内或标签页隐藏时停止 rAF。
 */

var TAU = Math.PI * 2;
var GOLDEN = 2.399963229728653;

var MAX_NODES = 140;
var AVATAR_LIMIT = 160;
var MAX_RELATIONS = 260;

// 相机与投影：焦距按视口短边取比例，保证不同尺寸下星图占比一致
var CAM_Z = 4.2;
var FOCAL_RATIO = 2.02;
var MIN_ZOOM = 0.55;
var MAX_ZOOM = 2.4;

// 布局半径（世界单位，1 ≈ 视野短边的一半）
var OVERVIEW_RADIUS = 0.62;
var ORBIT_RADIUS = 0.50;
var PARK_RADIUS = 1.22;
var MEMBER_WORLD_R = 0.092;
var FOCUS_WORLD_R = 0.126;

// 自转角速度（弧度/毫秒），约 2.5°/s，比参考视频再慢一点
var AUTO_SPIN = 0.000042;
var FOCUS_SPIN_RATIO = 0.34;

var REVEAL_DURATION = 560;
var REVEAL_STAGGER = 40;

var DEFAULT_ACCENT = '209,62,67';

// 关系数据：优先成员级（大模型逐对分析），退回学校级（大模型分析学校关联）
var MEMBER_AFFINITY_ENDPOINT = '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers/member-affinity';
var SCHOOL_AFFINITY_ENDPOINT = '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers/school-affinity';

// 头像代理：QQ 头像 CDN 不返回 CORS 头，画布读不到像素，取主色必须走同源代理
var AVATAR_CDN = /^https?:\/\/(?:q[1-3]|thirdqq)\.qlogo\.cn\//i;
var AVATAR_PROXY = '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers/avatar?url=';

var FONT_STACK = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

// —— 前端假成员（仅预览用，不改数据库）——
// 真实成员少时（线上目前 6 人），星图太稀疏，走马灯 / 「查看全部关系」看不出效果。
// 这里注入一批合成成员卡片，结构对齐 .member-card 的读取字段，buildGraph 一视同仁。
// 上线前把 TEST_MEMBERS_ENABLED 置 false 即可，不影响任何真实数据。
// i18n-ignore-start：以下为测试成员姓名/学校/分组，属临时预览数据，不进词典
var TEST_MEMBERS_ENABLED = true;
var TEST_MEMBERS = [
  { name: '重大万能墙', school: '重庆大学', group: '重庆校墙联' },
  { name: '重大虎溪墙', school: '重庆大学', group: '重庆校墙联' },
  { name: '重大A区墙', school: '重庆大学', group: '重庆校墙联' },
  { name: '重大B区墙', school: '重庆大学', group: '重庆校墙联' },
  { name: '重大C区墙', school: '重庆大学', group: '重庆校墙联' },
  { name: '重大D区墙', school: '重庆大学', group: '重庆校墙联' },
  { name: '西大万能墙', school: '西南大学', group: '重庆校墙联' },
  { name: '西政万能墙', school: '西南政法大学', group: '重庆校墙联' },
  { name: '重师万能墙', school: '重庆师范大学', group: '重庆校墙联' },
  { name: '重邮万能墙', school: '重庆邮电大学', group: '重庆校墙联' },
  { name: '川外万能墙', school: '四川外国语大学', group: '重庆校墙联' },
  { name: '西大北碚墙', school: '西南大学', group: '重庆校墙联' }
];
// i18n-ignore-end

// 头像取色失败时的兜底配色（按成员顺序分配，保证每个人仍有可区分的颜色）
var PALETTE = [
  '110,231,215',
  '127,178,255',
  '255,212,121',
  '255,143,177',
  '183,155,255',
  '163,230,53',
  '255,164,96',
  '120,200,255'
];

var CURVE_SAMPLES = 12;

function clamp(value, min, max) {
  return value < min ? min : (value > max ? max : value);
}

// 带一点回弹的出场曲线，星点"亮起来"的手感更接近系统动画
function easeOutBack(t) {
  var c1 = 1.70158;
  var c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// 字符串 → 稳定的 0..1 小数：给每个成员派生固定的抖动，
// 同一成员每次刷新都落在同一位置，不会每次进页面都换一张图
function hash01(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
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
  // 「查看全部关系」面板在 section 之外（星图下方），从 document 查，不能 section.querySelector
  var allEl = document.querySelector('[data-member-network-all]') || null;
  var focusEl = section.querySelector('[data-member-network-focus]');
  var rotateBtn = section.querySelector('[data-member-network-rotate]');
  var resetBtn = section.querySelector('[data-member-network-reset]');

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

  // —— 数据 ——
  var nodes = [];            // 全部是成员，没有学校 / 分组节点
  var edges = [];            // 由 relations 派生，供渲染用
  var relations = [];        // { a, b, strength, category, reason, source }
  var aiLoaded = false;
  var aiState = { status: 'idle', reason: '', meta: null, source: 'none' };
  var linkPaths = [];        // 参与悬停命中的连线
  var hoveredLink = null;
  var signature = '';
  var accent = readAccent();
  var avatarCache = new Map();

  // —— 视图 ——
  var view = { yaw: 0.42, pitch: -0.16, zoom: 1 };
  var zoomTarget = 1;
  var spinVX = 0;
  var spinVY = 0;
  var autoSpin = true;

  // —— 聚焦 ——
  var focusNode = null;
  var relatedStrength = new Map();   // 聚焦时：关联节点 → 强度
  var relatedList = [];

  var active = false;
  var inView = true;
  var width = 0;
  var height = 0;

  var revealAt = 0;
  var pointer = { x: -1, y: -1, inside: false, dragging: false, moved: 0, lastX: 0, lastY: 0, id: null };
  var hovered = null;
  var focused = null;
  var frame = null;
  var lastTime = 0;
  var listeners = [];
  var starSeed = 0;

  // —— 沉浸态：进入「关系网」视图后整页切夜色 ——
  // immersive = 是否处于「关系网 + 全屏星图」状态；由视图切换控制，明暗切换不再解除。
  var immersive = false;
  var immersivePrevTheme = 'light';
  var suppressThemeWatch = false;
  var themeTransitionTimer = null;
  // 关系分析面板的 resize 监听解绑器：面板每次重建都要换新，避免监听堆积
  var affinityResizeOff = null;

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

  // ======================= 离屏辉光精灵 =======================

  var glowCache = new Map();

  /**
   * 辉光精灵：一张 128px 的径向渐变贴图，按颜色缓存。
   * 每帧 createRadialGradient 在低端机上很贵，贴图缩放几乎没有成本。
   */
  function glowSprite(rgb) {
    var hit = glowCache.get(rgb);
    if (hit) {
      return hit;
    }
    if (glowCache.size > 220) {
      glowCache.clear();
    }
    var size = 128;
    var off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    var g = off.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(' + rgb + ',0.95)');
    grad.addColorStop(0.16, 'rgba(' + rgb + ',0.55)');
    grad.addColorStop(0.42, 'rgba(' + rgb + ',0.16)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2, 0, TAU);
    g.fill();
    glowCache.set(rgb, off);
    return off;
  }

  // ======================= 头像与主色调 =======================

  function avatarSource(url) {
    if (!url) {
      return '';
    }
    return AVATAR_CDN.test(url) ? AVATAR_PROXY + encodeURIComponent(url) : url;
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var l = (max + min) / 2;
    if (max === min) {
      return { h: 0, s: 0, l: l };
    }
    var d = max - min;
    var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    var h;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      var v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    function hue2rgb(p, q, input) {
      var value = input;
      if (value < 0) value += 1;
      if (value > 1) value -= 1;
      if (value < 1 / 6) return p + (q - p) * 6 * value;
      if (value < 1 / 2) return q;
      if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return {
      r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    };
  }

  /**
   * 只取有彩色像素的加权平均：去掉接近纯黑（头发）与接近纯白（背景）的像素，
   * 再按饱和度加权，避免整张图的平均色变成灰。最后把明度/饱和度夹到发光区间，
   * 否则深色头像的光晕在深底上会看不见。
   */
  function sampleAvatarColor(image) {
    try {
      var size = 20;
      var off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      var g = off.getContext('2d', { willReadFrequently: true });
      g.drawImage(image, 0, 0, size, size);
      var data = g.getImageData(0, 0, size, size).data;
      var sumR = 0, sumG = 0, sumB = 0, weight = 0;
      for (var i = 0; i < data.length; i += 4) {
        var alpha = data[i + 3] / 255;
        if (alpha < 0.6) {
          continue;
        }
        var r = data[i], gg = data[i + 1], b = data[i + 2];
        var max = Math.max(r, gg, b);
        var min = Math.min(r, gg, b);
        var lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
        if (lum > 0.93 || lum < 0.07) {
          continue;
        }
        var sat = max === 0 ? 0 : (max - min) / max;
        var w = 0.2 + sat * sat * 3.4;
        sumR += r * w;
        sumG += gg * w;
        sumB += b * w;
        weight += w;
      }
      if (!weight) {
        return null;
      }
      var hsl = rgbToHsl(sumR / weight, sumG / weight, sumB / weight);
      // 近灰头像给一点色相偏移也没有意义，直接交给兜底配色
      if (hsl.s < 0.09) {
        return null;
      }
      var rgb = hslToRgb(hsl.h, clamp(hsl.s, 0.44, 0.9), clamp(hsl.l, 0.46, 0.6));
      return rgb.r + ',' + rgb.g + ',' + rgb.b;
    } catch (error) {
      // 画布被污染（非代理的跨域头像）时读不到像素，退回兜底配色
      return null;
    }
  }

  function loadAvatar(url) {
    if (!url) {
      return null;
    }
    var cached = avatarCache.get(url);
    if (cached) {
      avatarCache.delete(url);
      avatarCache.set(url, cached);
      return cached;
    }
    var entry = { image: new Image(), ready: false, color: null, triedFallback: false, source: url };
    entry.image.decoding = 'async';
    entry.image.onload = function() {
      entry.ready = entry.image.naturalWidth > 0;
      if (entry.ready) {
        entry.color = sampleAvatarColor(entry.image);
      }
      requestDraw();
      makeSureAnimating();
    };
    entry.image.onerror = function() {
      entry.ready = false;
      // 代理不可用（插件未启用 / 版本较旧）时退回原始地址，至少别把头像丢掉
      if (!entry.triedFallback && entry.source && entry.image.src.indexOf(AVATAR_PROXY) >= 0) {
        entry.triedFallback = true;
        entry.image.src = url;
        return;
      }
      requestDraw();
    };
    entry.image.src = avatarSource(url);
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
        + '#' + (list[i].getAttribute('data-school') || '')
      );
    }
    return list.length + ':' + parts.join('|');
  }

  // 球面均匀分布（Fibonacci），成员之间三维间距稳定，不会挤在赤道上
  function spherePoint(index, total, radius) {
    var y = 1 - (index + 0.5) * 2 / Math.max(1, total);
    var ring = Math.sqrt(Math.max(0, 1 - y * y));
    var phi = index * GOLDEN;
    return {
      x: Math.cos(phi) * ring * radius,
      y: y * radius,
      z: Math.sin(phi) * ring * radius
    };
  }

  function makeNode(name, x, y, z, worldR, fallbackColor) {
    return {
      kind: 'member',
      name: name,
      x: x,
      y: y,
      z: z,
      tx: x,
      ty: y,
      tz: z,
      worldR: worldR,
      targetR: worldR,
      fallbackColor: fallbackColor,
      avatar: null,
      card: null,
      trigger: null,
      group: '',
      school: '',
      initial: '',
      // 屏幕态
      sx: 0,
      sy: 0,
      radius: 0,
      depth: 1,
      depthAlpha: 1,
      alpha: 1,
      targetAlpha: 1,
      depthScale: 1,
      scale: 1,
      hoverEase: 0,
      reveal: 0,
      delay: 0
    };
  }

  function nodeColor(node) {
    if (node.avatar && node.avatar.color) {
      return node.avatar.color;
    }
    return node.fallbackColor || accent;
  }

  /**
   * 构图：只有成员，没有学校 / 分组这一层。
   * 学校只作为"关系依据"参与连线，不再出现在节点与标签上。
   */
  function buildGraph(cards) {
    var list = cards;
    if (cards.length > MAX_NODES) {
      list = [];
      var step = cards.length / MAX_NODES;
      for (var s = 0; s < MAX_NODES; s++) {
        list.push(cards[Math.floor(s * step)]);
      }
    }

    // 前端假成员注入：真实成员过少时补到星图里，便于预览走马灯与「查看全部关系」。
    // 合成卡片是纯内存 DOM，不进列表、不进库，只喂给 buildGraph。
    if (TEST_MEMBERS_ENABLED) {
      var existing = {};
      for (var ei = 0; ei < list.length; ei++) {
        var en = list[ei].querySelector('.member-name');
        if (en) existing[(en.textContent || '').trim()] = true;
      }
      var synthetic = [];
      for (var ti = 0; ti < TEST_MEMBERS.length; ti++) {
        var fake = TEST_MEMBERS[ti];
        if (existing[fake.name]) continue;
        var holder = document.createElement('div');
        holder.setAttribute('data-school', fake.school);
        holder.setAttribute('data-group', fake.group);
        var nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = fake.name;
        holder.appendChild(nameSpan);
        // 不塞头像 img：buildGraph 读不到 src 时走首字占位，符合「头像缺失」的真实情况
        synthetic.push(holder);
      }
      list = list.concat(synthetic);
    }

    nodes = [];
    edges = [];
    relations = [];
    linkPaths.length = 0;
    hovered = null;
    focused = null;
    hoveredLink = null;
    focusNode = null;
    relatedStrength.clear();
    relatedList = [];
    hideTip();
    hideLinkTip();
    renderFocusLine();
    renderAffinityPanel(null);

    for (var i = 0; i < list.length; i++) {
      var card = list[i];
      var nameEl = card.querySelector('.member-name');
      var img = card.querySelector('.member-avatar img');
      var avatarUrl = img && img.getAttribute('src') ? img.getAttribute('src') : '';
      var slot = card.closest ? card.closest('.member-card-slot') : null;
      var name = (nameEl ? (nameEl.textContent || '').trim() : '') || t('members.labelMembers');
      var node = makeNode(
        name,
        0,
        0,
        0,
        MEMBER_WORLD_R,
        PALETTE[i % PALETTE.length]
      );
      node.avatar = avatarUrl ? loadAvatar(avatarUrl) : null;
      node.card = card;
      node.group = card.getAttribute('data-group') || '';
      node.school = (card.getAttribute('data-school') || '').trim();
      node.trigger = slot ? slot.querySelector('[data-member-preview]') : null;
      node.initial = name.slice(0, 1);
      node.delay = 60 + i * REVEAL_STAGGER;
      nodes.push(node);
    }

    // 初始位置先落在球面上，聚焦动画从真实位置开始，不会有"从原点炸开"的跳变
    layoutOverview(nodes);
    for (var n = 0; n < nodes.length; n++) {
      nodes[n].x = nodes[n].tx;
      nodes[n].y = nodes[n].ty;
      nodes[n].z = nodes[n].tz;
      nodes[n].alpha = nodes[n].targetAlpha;
    }

    buildLocalRelations();
    rebuildEdges();

    zoomTarget = 1;
    revealAt = prefersReducedMotion() ? 0 : now();
    buildFocusList();
    loadAffinity();
  }

  // ======================= 关系数据 =======================

  function addRelation(a, b, strength, category, reason, source) {
    if (!a || !b || a === b || relations.length >= MAX_RELATIONS) {
      return null;
    }
    var lo = a.name < b.name ? a : b;
    var hi = a.name < b.name ? b : a;
    for (var i = 0; i < relations.length; i++) {
      var existing = relations[i];
      if (existing.a === lo && existing.b === hi) {
        if (strength > existing.strength) {
          existing.strength = strength;
          existing.category = category;
          existing.reason = reason;
          existing.source = source;
        }
        return existing;
      }
    }
    var link = {
      a: lo,
      b: hi,
      strength: clamp(strength, 0, 1),
      category: category,
      reason: reason || '',
      source: source
    };
    relations.push(link);
    return link;
  }

  /**
   * 本地结构关系：同校一条（强），同组一条（弱）。
   * 同校成员很多时只连成一条链，避免 n² 条线把画面糊死。
   */
  function buildLocalRelations() {
    var bySchool = {};
    var byGroup = {};
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.school) {
        (bySchool[node.school] = bySchool[node.school] || []).push(node);
      }
      if (node.group) {
        (byGroup[node.group] = byGroup[node.group] || []).push(node);
      }
    }

    Object.keys(bySchool).forEach(function(school) {
      var bucket = bySchool[school];
      if (bucket.length < 2) {
        return;
      }
      if (bucket.length <= 6) {
        for (var m = 0; m < bucket.length; m++) {
          for (var k = m + 1; k < bucket.length; k++) {
            addRelation(bucket[m], bucket[k], 0.62, 'school', t('network.sameSchoolReason'), 'local');
          }
        }
        return;
      }
      // 人数多时连成环：每人只连左右各一位，线少但仍成网
      for (var r = 0; r < bucket.length; r++) {
        addRelation(bucket[r], bucket[(r + 1) % bucket.length], 0.5, 'school',
          t('network.sameSchoolReason'), 'local');
      }
    });

    Object.keys(byGroup).forEach(function(group) {
      var bucket = byGroup[group];
      if (bucket.length < 2 || bucket.length > 12) {
        return;
      }
      for (var r = 0; r < bucket.length; r++) {
        addRelation(bucket[r], bucket[(r + 1) % bucket.length], 0.38, 'group',
          t('network.sameGroupReason'), 'local');
      }
    });
  }

  /**
   * 把 AI 关联落到成员上：
   * - 成员级接口（member-affinity）直接用；
   * - 学校级接口（school-affinity）按两成员所属学校的关联推导，
   *   强度略降，理由沿用模型给出的原话。
   */
  function applyAiRelations(data) {
    if (!data || !Array.isArray(data.links) || !data.links.length) {
      return 0;
    }
    var byName = {};
    var bySchool = {};
    for (var i = 0; i < nodes.length; i++) {
      byName[nodes[i].name] = nodes[i];
      if (nodes[i].school) {
        (bySchool[nodes[i].school] = bySchool[nodes[i].school] || []).push(nodes[i]);
      }
    }

    var memberLevel = data.links.some(function(link) {
      return link && byName[link.a] && byName[link.b];
    });

    var added = 0;
    if (memberLevel) {
      aiState.source = 'member';
      data.links.forEach(function(link) {
        var a = byName[link.a];
        var b = byName[link.b];
        if (!a || !b) {
          return;
        }
        var strength = typeof link.strength === 'number' ? link.strength : 0.3;
        if (strength < affinityMinStrength) {
          return;
        }
        if (addRelation(a, b, strength, link.category || 'link', link.reason || '', 'ai')) {
          added++;
        }
      });
      return added;
    }

    aiState.source = 'school';
    data.links.forEach(function(link) {
      var left = bySchool[link.a];
      var right = bySchool[link.b];
      if (!left || !right) {
        return;
      }
      var strength = (typeof link.strength === 'number' ? link.strength : 0.3) * 0.85;
      if (strength < affinityMinStrength) {
        return;
      }
      for (var m = 0; m < left.length; m++) {
        for (var k = 0; k < right.length; k++) {
          if (addRelation(left[m], right[k], strength, link.category || 'link',
            link.reason || '', 'ai')) {
            added++;
          }
        }
      }
    });
    return added;
  }

  /**
   * 拉取关系数据。先问成员级接口，404 / 空结果再退学校级；
   * 两层都不可用就只剩本地同校同组，界面上会写明"AI 不可用"。
   */
  function loadAffinity() {
    if (!affinityEnabled) {
      aiState.status = 'disabled';
      aiLoaded = true;
      applyAiRelations(null);
      rebuildEdges();
      renderAffinityPanel(focusNode);
      renderFocusLine();
      return;
    }
    if (aiLoaded) {
      rebuildEdges();
      return;
    }
    aiLoaded = true;
    aiState.status = 'loading';

    fetchJson(MEMBER_AFFINITY_ENDPOINT)
      .then(function(data) {
        if (data && Array.isArray(data.links) && data.links.length) {
          return data;
        }
        return fetchJson(SCHOOL_AFFINITY_ENDPOINT);
      })
      .then(function(data) {
        aiState.status = data ? 'ready' : 'failed';
        aiState.reason = data && data.reason ? data.reason : '';
        aiState.meta = data && data.meta ? data.meta : null;
        if (data && data.enabled === false) {
          aiState.status = 'disabled';
        }
        applyAiRelations(data);
        rebuildEdges();
        renderAffinityPanel(focusNode);
        renderFocusLine();
        requestDraw();
        makeSureAnimating();
      })
      .catch(function() {
        aiState.status = 'failed';
        aiState.reason = 'ai-unavailable';
        rebuildEdges();
        renderAffinityPanel(focusNode);
        renderFocusLine();
      });
  }

  function fetchJson(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function(resp) {
        return resp.ok ? resp.json() : null;
      })
      .catch(function() {
        return null;
      });
  }

  function rebuildEdges() {
    edges = [];
    linkPaths.length = 0;
    hoveredLink = null;
    for (var i = 0; i < relations.length; i++) {
      var relation = relations[i];
      var edge = makeEdge(relation.a, relation.b, relation.strength, relation);
      edges.push(edge);
      linkPaths.push(edge);
    }
  }

  /** 与指定成员有关的关系，按强度排序 */
  function relationsOf(node) {
    var out = [];
    for (var i = 0; i < relations.length; i++) {
      var relation = relations[i];
      if (relation.a === node || relation.b === node) {
        out.push(relation);
      }
    }
    out.sort(function(x, y) {
      return y.strength - x.strength;
    });
    return out;
  }

  /**
   * 一条纤维：三点贝塞尔，控制点在两端中点法向偏移，弧线走向随位置变化。
   * 控制点只依赖世界坐标，构图时算一次即可。
   */
  function makeEdge(a, b, weight, link) {
    var seed = hash01(a.name + '>' + b.name);
    return {
      a: a,
      b: b,
      weight: weight,
      link: link,
      // 弯曲量按当前长度比例算，控制点在绘制时求值：聚焦重排后弧线不会脱节
      bendRatio: (0.12 + seed * 0.1) * (seed > 0.5 ? 1 : -1),
      strands: weight >= 0.6 ? 5 : (weight >= 0.4 ? 4 : 3),
      particles: seed > 0.35 ? [{ t: seed, speed: 0.00012 + seed * 0.00018 }] : [],
      ctrl: { x: 0, y: 0, z: 0 },
      points: []
    };
  }

  /** 控制点跟着两端实时重算：中点 + 垂直于连线的偏移 */
  function updateEdgeCtrl(edge) {
    var a = edge.a;
    var b = edge.b;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dz = b.z - a.z;
    var length = Math.hypot(dx, dy, dz) || 1;
    var helper = Math.abs(dy / length) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    var nx = helper.y * dz - helper.z * dy;
    var ny = helper.z * dx - helper.x * dz;
    var nz = helper.x * dy - helper.y * dx;
    var nlen = Math.hypot(nx, ny, nz) || 1;
    var bend = length * edge.bendRatio;
    edge.ctrl.x = (a.x + b.x) / 2 + (nx / nlen) * bend;
    edge.ctrl.y = (a.y + b.y) / 2 + (ny / nlen) * bend;
    edge.ctrl.z = (a.z + b.z) / 2 + (nz / nlen) * bend;
  }

  // ======================= 关系分析面板 =======================

  var CATEGORY_LABELS = {
    cooperation: t('network.partner'),
    region: t('network.region'),
    organization: t('network.smallOrg'),
    school: t('network.sameSchool'),
    group: t('network.sameGroup'),
    link: t('network.linkFallback')
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

  function normalizedStrength(link) {
    var value = link && typeof link.strength === 'number' ? link.strength : 0.3;
    return clamp(value, 0, 1);
  }

  /**
   * 关系分析面板：默认收起，点开某位成员后才出现，且只讲「以他为中心」的关联。
   * focus 为 null 表示当前是全员视图，面板直接隐藏。
   */
  // 面板抬头的头像：先显首字，图到了再换，避免头像未就绪时留一个空圈
  function buildAffinityAvatar(node) {
    var box = document.createElement('span');
    box.className = 'member-network-affinity-avatar';
    var fallback = node && node.initial ? node.initial : '·';
    var src = node && node.avatar && node.avatar.source ? avatarSource(node.avatar.source) : '';
    box.textContent = fallback;
    if (!src) {
      return box;
    }
    var img = new Image();
    img.alt = '';
    img.onload = function() {
      if (img.naturalWidth > 0) {
        box.textContent = '';
        box.appendChild(img);
      }
    };
    img.src = src;
    return box;
  }

  function renderAffinityPanel(focus) {
    if (!affinityEl || !affinityShowReason) {
      return;
    }
    while (affinityEl.firstChild) {
      affinityEl.removeChild(affinityEl.firstChild);
    }
    // 焦点变化时收起「查看全部关系」展开面板，避免残留上一个成员的关系
    if (allEl) {
      allEl.hidden = true;
    }
    if (!affinityEnabled || !focus) {
      affinityEl.hidden = true;
      return;
    }

    // 只取与当前成员直接相连的关系，其余一概不进面板
    var mine = relations.filter(function(relation) {
      return relation.a === focus || relation.b === focus;
    });

    affinityEl.hidden = false;

    affinityEl.setAttribute('role', 'group');
    affinityEl.setAttribute('aria-label', t('network.memberAnalysis', focus.name));
    // 抬头只留「头像 + 名字」；关系统计已上移到聚焦行（hud），弹窗内不再重复显示
    var head = document.createElement('div');
    head.className = 'member-network-affinity-head';
    var who = document.createElement('span');
    who.className = 'member-network-affinity-who';
    who.appendChild(buildAffinityAvatar(focus));
    var title = document.createElement('strong');
    title.className = 'member-network-affinity-name';
    title.textContent = focus.name;
    who.appendChild(title);
    head.appendChild(who);
    affinityEl.appendChild(head);

    // 聚焦提示：去掉重复的名字，第一行只写「几组关系」，换行再写「参与分析几所学校」
    var focusMeta = aiState.meta || {};
    var focusLines = [t('network.memberAnalysisMeta', mine.length)];
    if (focusMeta.schoolCount) {
      focusLines.push(t('network.schools', focusMeta.schoolCount));
    }
    var focusLineEl = document.createElement('p');
    focusLineEl.className = 'member-network-affinity-focus';
    focusLineEl.textContent = focusLines.join('\n');
    affinityEl.appendChild(focusLineEl);

    if (!mine.length) {
      var empty = document.createElement('p');
      empty.className = 'member-network-affinity-empty';
      empty.textContent = t('network.memberNoPair', focus.name);
      affinityEl.appendChild(empty);
      return;
    }

    var sorted = mine.slice().sort(function(x, y) {
      return y.strength - x.strength;
    });
    // 关联成员：竖向单列胶囊，头像 + 名字占满浮层宽度。
    // 全部列出、不截断：条目超出面板高度时由下面的走马灯自动滚动（悬停暂停），
    // 「查看全部关系」按钮仍在星图下方展开完整通栏列表。
    var scroll = document.createElement('div');
    scroll.className = 'member-network-affinity-scroll';
    var list = document.createElement('ul');
    list.className = 'member-network-affinity-list';
    sorted.forEach(function(relation) {
      var other = relation.a === focus ? relation.b : relation.a;
      var item = document.createElement('li');
      item.className = 'member-network-affinity-chip';

      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'member-network-affinity-chip-btn';
      chip.setAttribute('aria-label',
        other.name + '：' + (CATEGORY_LABELS[relation.category] || t('network.linkFallback'))
        + ' · ' + strengthLabel(relation.strength)
        + (relation.reason && relation.source === 'ai' ? ' · ' + relation.reason : ''));
      chip.appendChild(buildAffinityAvatar(other));
      var name = document.createElement('span');
      name.className = 'member-network-affinity-chip-name';
      name.textContent = other.name;
      chip.appendChild(name);

      // 关联揭示浮层：分类 + 强度 +（AI 结论的理由）
      var pop = document.createElement('span');
      pop.className = 'member-network-affinity-pop';
      var line = document.createElement('span');
      line.className = 'member-network-affinity-pop-line';
      line.textContent = (CATEGORY_LABELS[relation.category] || t('network.linkFallback'))
        + ' · ' + strengthLabel(relation.strength);
      pop.appendChild(line);
      if (relation.reason && relation.source === 'ai') {
        var why = document.createElement('span');
        why.className = 'member-network-affinity-pop-reason';
        why.textContent = relation.reason;
        pop.appendChild(why);
      }
      chip.appendChild(pop);

      item.appendChild(chip);
      list.appendChild(item);
    });
    scroll.appendChild(list);
    affinityEl.appendChild(scroll);

    // 胶囊超出可视高度时启动走马灯：复制一份内容，向上无缝循环滚动（无跳变卡顿）。
    // 滚动速度按内容高度换算（每 30px 约 1s），成员越多滚得越慢，读得清。
    var markMarquee = function() {
      if (!scroll.isConnected || !list.isConnected) return;
      var overflow = list.scrollHeight > scroll.clientHeight + 4;
      var running = scroll.classList.contains('is-marquee');
      if (overflow === running) return;
      if (overflow) {
        // 复制一份列表实现首尾无缝衔接
        var clone = list.cloneNode(true);
        clone.className = 'member-network-affinity-list member-network-affinity-list-clone';
        clone.setAttribute('aria-hidden', 'true');
        // 克隆体只做视觉循环，不能进 Tab 焦点顺序
        Array.prototype.forEach.call(clone.querySelectorAll('button'), function(btn) {
          btn.setAttribute('tabindex', '-1');
        });
        scroll.appendChild(clone);
        scroll.classList.add('is-marquee');
        scroll.style.setProperty('--affinity-marquee-duration',
          Math.max(6, Math.round(list.scrollHeight / 30)) + 's');
      } else {
        var extra = scroll.querySelector('.member-network-affinity-list-clone');
        if (extra) scroll.removeChild(extra);
        scroll.classList.remove('is-marquee');
      }
    };
    requestAnimationFrame(markMarquee);
    // 面板重建后旧监听必须撤掉，否则每次点击成员都多挂一个 resize 监听
    if (affinityResizeOff) affinityResizeOff();
    window.addEventListener('resize', markMarquee, { passive: true });
    affinityResizeOff = function() {
      window.removeEventListener('resize', markMarquee);
      affinityResizeOff = null;
    };

    // 主要关系人旁放「查看全部关系」：点开在星图下方通栏展示，无需悬浮
    if (sorted.length > 0) {
      var viewAll = document.createElement('button');
      viewAll.type = 'button';
      viewAll.className = 'member-network-affinity-viewall';
      viewAll.textContent = t('network.viewAll');
      viewAll.addEventListener('click', function() {
        toggleAllPanel(focus);
      });
      affinityEl.appendChild(viewAll);
    }
  }

  // 展开「全部关系」：星图下方通栏面板，列出该成员全部关系（不截断、不悬浮）。
  function renderAllPanel(focus) {
    if (!allEl) {
      return;
    }
    while (allEl.firstChild) {
      allEl.removeChild(allEl.firstChild);
    }
    if (!focus) {
      allEl.hidden = true;
      return;
    }
    var mine = relations.filter(function(relation) {
      return relation.a === focus || relation.b === focus;
    });
    allEl.hidden = false;

    var head = document.createElement('div');
    head.className = 'member-network-all-head';
    var title = document.createElement('span');
    title.className = 'member-network-all-title';
    title.appendChild(buildAffinityAvatar(focus));
    var titleText = document.createElement('span');
    titleText.className = 'member-network-all-title-text';
    titleText.textContent = t('network.memberAnalysis', focus.name);
    title.appendChild(titleText);
    head.appendChild(title);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'member-network-all-close';
    close.textContent = t('network.viewAllClose');
    close.addEventListener('click', function() {
      allEl.hidden = true;
    });
    head.appendChild(close);
    allEl.appendChild(head);

    if (!mine.length) {
      var empty = document.createElement('p');
      empty.className = 'member-network-affinity-empty';
      empty.textContent = t('network.memberNoPair', focus.name);
      allEl.appendChild(empty);
      return;
    }

    var sorted = mine.slice().sort(function(x, y) { return y.strength - x.strength; });
    var grid = document.createElement('ul');
    grid.className = 'member-network-all-grid';
    sorted.forEach(function(relation) {
      var other = relation.a === focus ? relation.b : relation.a;
      var item = document.createElement('li');
      item.className = 'member-network-all-item';
      item.appendChild(buildAffinityAvatar(other));
      var body = document.createElement('span');
      body.className = 'member-network-all-body';
      var nm = document.createElement('span');
      nm.className = 'member-network-all-name';
      nm.textContent = other.name;
      body.appendChild(nm);
      var meta = document.createElement('span');
      meta.className = 'member-network-all-meta';
      meta.textContent = (CATEGORY_LABELS[relation.category] || t('network.linkFallback'))
        + ' · ' + strengthLabel(relation.strength);
      body.appendChild(meta);
      if (relation.reason && relation.source === 'ai') {
        var why = document.createElement('span');
        why.className = 'member-network-all-reason';
        why.textContent = relation.reason;
        body.appendChild(why);
      }
      item.appendChild(body);
      grid.appendChild(item);
    });
    allEl.appendChild(grid);
  }

  function toggleAllPanel(focus) {
    if (allEl && !allEl.hidden) {
      allEl.hidden = true;
      return;
    }
    renderAllPanel(focus);
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
      button.textContent = node.name;
      button.addEventListener('click', function() {
        activateNode(node);
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
      aiLoaded = false;
      buildGraph(next);
    }
    if (countEl) {
      countEl.textContent = t('network.memberCount', next.length);
    }
    requestDraw();
    if (active && !prefersReducedMotion()) {
      schedule();
    }
  }

  // ======================= 聚焦与布局 =======================

  function setFocus(node) {
    if (focusNode === node) {
      return;
    }
    focusNode = node;
    hovered = null;
    hideTip();
    relatedStrength.clear();
    relatedList = [];
    if (node) {
      var links = relationsOf(node);
      for (var i = 0; i < links.length; i++) {
        var other = links[i].a === node ? links[i].b : links[i].a;
        if (!relatedStrength.has(other) || relatedStrength.get(other) < links[i].strength) {
          relatedStrength.set(other, links[i].strength);
        }
      }
      relatedList = Array.from(relatedStrength.keys()).sort(function(x, y) {
        return relatedStrength.get(y) - relatedStrength.get(x);
      });
      zoomTarget = 1.1;
    } else {
      zoomTarget = 1;
    }
    layoutTargets();
    if (prefersReducedMotion()) {
      stepMotion(400);
    }
    renderFocusLine();
    renderAffinityPanel(node);
    requestDraw();
    makeSureAnimating();
  }

  function layoutOverview(list) {
    for (var i = 0; i < list.length; i++) {
      var point = spherePoint(i, list.length, OVERVIEW_RADIUS);
      list[i].tx = point.x;
      list[i].ty = point.y * 0.86;
      list[i].tz = point.z;
      list[i].targetR = MEMBER_WORLD_R;
      list[i].targetAlpha = 1;
    }
  }

  /**
   * 聚焦：被选中的头像移到中心并放大，直接关联的成员围成一圈，
   * 其余头像推到外圈压暗——"以我为中心的关系网"一眼能读出来。
   */
  function layoutTargets() {
    if (!focusNode) {
      layoutOverview(nodes);
      return;
    }
    focusNode.tx = 0;
    focusNode.ty = 0;
    focusNode.tz = 0;
    focusNode.targetR = FOCUS_WORLD_R;
    focusNode.targetAlpha = 1;

    var orbitCount = relatedList.length;
    // 每个成员的环绕起点不同（由名字派生），换人聚焦时不会每次都摆成同一条直线
    var phase = hash01(focusNode.name) * TAU;
    var tilt = 0.3;
    var parked = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node === focusNode) {
        continue;
      }
      var index = relatedList.indexOf(node);
      if (index >= 0) {
        var angle = phase + (index / Math.max(1, orbitCount)) * TAU;
        var radius = ORBIT_RADIUS * (orbitCount <= 6 ? 1 : 1.06);
        // 椭圆轨道整体倾斜一点，两个关联人时也不会连成一条水平线
        var ox = Math.cos(angle) * radius;
        var oy = Math.sin(angle) * radius * 0.74;
        node.tx = ox * Math.cos(tilt) - oy * Math.sin(tilt);
        node.ty = ox * Math.sin(tilt) + oy * Math.cos(tilt);
        node.tz = Math.sin(angle * 1.7) * 0.26;
        node.targetR = MEMBER_WORLD_R * 0.95;
        node.targetAlpha = 0.96;
      } else {
        parked.push(node);
      }
    }
    for (var p = 0; p < parked.length; p++) {
      var point = spherePoint(p, parked.length, PARK_RADIUS);
      parked[p].tx = point.x;
      parked[p].ty = point.y * 0.8;
      parked[p].tz = point.z;
      parked[p].targetR = MEMBER_WORLD_R * 0.62;
      // 与聚焦无关的成员只留极淡的存在感，不参与视觉竞争
      parked[p].targetAlpha = 0.07;
    }
  }

  function renderFocusLine() {
    if (!focusEl) {
      return;
    }
    if (!focusNode) {
      focusEl.hidden = true;
      focusEl.textContent = '';
      return;
    }
    // 聚焦行：名字 + 直接相连关系数 +（大模型参与分析的学校数）
    var mine = relations.filter(function(relation) {
      return relation.a === focusNode || relation.b === focusNode;
    });
    var meta = aiState.meta || {};
    focusEl.hidden = false;
    var line = t('members.networkFocus', focusNode.name, mine.length);
    if (meta.schoolCount) {
      line += ' · ' + t('network.schools', meta.schoolCount);
    }
    focusEl.textContent = line;
  }

  // ======================= 3D 投影 =======================

  var focal = 0;
  // 画布通常比高宽得多：横向拉伸一点，星图才不会缩在中间一条竖带上
  var xStretch = 1;

  function projectNode(node) {
    var cy = Math.cos(view.yaw);
    var sy = Math.sin(view.yaw);
    var cp = Math.cos(view.pitch);
    var sp = Math.sin(view.pitch);

    var x1 = node.x * cy + node.z * sy;
    var z1 = -node.x * sy + node.z * cy;
    var y2 = node.y * cp - z1 * sp;
    var z2 = node.y * sp + z1 * cp;

    var depth = CAM_Z - z2;
    if (depth < 0.8) {
      depth = 0.8;
    }
    var scale = focal / depth * view.zoom;
    node.sx = width / 2 + x1 * scale * xStretch;
    node.sy = height / 2 + 4 + y2 * scale;
    node.depth = depth;
    // 近大远小：以相机距离 4.2 为基准
    node.depthScale = clamp(1 + (CAM_Z - depth) * 0.16, 0.82, 1.18);
    node.radius = node.worldR * scale;
    node.depthAlpha = clamp(0.34 + (5.4 - depth) * 0.30, 0.24, 1);
  }

  // ======================= 背景 =======================

  var stars = [];
  var dust3d = [];

  function initStars() {
    stars.length = 0;
    for (var i = 0; i < 140; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.3 + Math.random() * 1.1,
        depth: 0.2 + Math.random() * 1.6,
        phase: Math.random() * TAU
      });
    }
    // 3D 星尘：跟着视角一起转，给"球形空间"一点体积感
    dust3d.length = 0;
    for (var d = 0; d < 64; d++) {
      var p = spherePoint(d, 96, 1.05 + Math.random() * 0.75);
      dust3d.push({
        x: p.x,
        y: p.y,
        z: p.z,
        size: 0.5 + Math.random() * 1.3,
        alpha: 0.12 + Math.random() * 0.4,
        phase: Math.random() * TAU
      });
    }
    starSeed++;
  }

  function drawBackdrop(time) {
    // 沉浸态：画布保持透明，透出整页 body 的深空底色与 CSS 星空层，
    // 只保留彩色光晕与画布内自转的星点，让星图真正「融进背景」。
    if (!immersive) {
      ctx.fillStyle = '#06070c';
      ctx.fillRect(0, 0, width, height);
    }

    var drift = Math.sin(view.yaw) * width * 0.02;
    var blobs = [
      { x: width * 0.36 + drift, y: height * 0.38, r: Math.max(width, height) * 0.52, rgb: accent, a: 0.11 },
      { x: width * 0.74 - drift * 1.4, y: height * 0.72, r: Math.max(width, height) * 0.46, rgb: '86,70,180', a: 0.12 },
      { x: width * 0.16 - drift, y: height * 0.82, r: Math.max(width, height) * 0.38, rgb: '24,120,150', a: 0.07 }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, 'rgba(' + b.rgb + ',' + b.a + ')');
      g.addColorStop(0.55, 'rgba(' + b.rgb + ',' + (b.a * 0.32).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + b.rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    for (var s = 0; s < stars.length; s++) {
      var star = stars[s];
      var sx = ((star.x + view.yaw * 0.018 * star.depth) % 1 + 1) % 1 * width;
      var sy = star.y * height;
      var twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * 0.0006 + star.phase));
      ctx.globalAlpha = 0.16 + twinkle * 0.42 * (0.5 + star.depth * 0.3);
      ctx.fillStyle = '#dfe6ff';
      ctx.beginPath();
      ctx.arc(sx, sy, star.size * (0.7 + star.depth * 0.25), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 暗角只在非沉浸态绘制：沉浸态已由整页背景统一，无需再压暗四角
    if (immersive) {
      return;
    }
    var vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.28,
      width / 2, height / 2, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  /** 3D 星尘：与节点共用同一套旋转与透视，随视角一起转，形成体积感 */
  function drawDust(time) {
    var cy = Math.cos(view.yaw);
    var sy = Math.sin(view.yaw);
    var cp = Math.cos(view.pitch);
    var sp = Math.sin(view.pitch);
    ctx.save();
    ctx.fillStyle = '#dfe6ff';
    for (var i = 0; i < dust3d.length; i++) {
      var d = dust3d[i];
      var x1 = d.x * cy + d.z * sy;
      var z1 = -d.x * sy + d.z * cy;
      var y2 = d.y * cp - z1 * sp;
      var z2 = d.y * sp + z1 * cp;
      var depth = CAM_Z - z2;
      if (depth < 0.9) {
        continue;
      }
      var scale = focal / depth * view.zoom;
      var sx = width / 2 + x1 * scale * xStretch;
      var sy2 = height / 2 + 4 + y2 * scale;
      if (sx < -5 || sy2 < -5 || sx > width + 5 || sy2 > height + 5) {
        continue;
      }
      var twinkle = 0.65 + 0.35 * Math.sin(time * 0.0009 + d.phase);
      ctx.globalAlpha = d.alpha * twinkle;
      ctx.beginPath();
      ctx.arc(sx, sy2, d.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ======================= 纤维 =======================

  /**
   * 把世界坐标的三次贝塞尔采样点投影到屏幕。
   * 每条纤维由 3~5 条平行细线组成，才有参考视频里"光纤束"的密度。
   */
  function drawEdge(edge, dim) {
    var cy = Math.cos(view.yaw);
    var sy = Math.sin(view.yaw);
    var cp = Math.cos(view.pitch);
    var sp = Math.sin(view.pitch);

    function project(x, y, z) {
      var x1 = x * cy + z * sy;
      var z1 = -x * sy + z * cy;
      var y2 = y * cp - z1 * sp;
      var z2 = y * sp + z1 * cp;
      var depth = CAM_Z - z2;
      if (depth < 0.8) {
        depth = 0.8;
      }
      var scale = focal / depth * view.zoom;
      return {
        x: width / 2 + x1 * scale * xStretch,
        y: height / 2 + 4 + y2 * scale,
        d: depth
      };
    }

    var a = edge.a;
    var b = edge.b;
    updateEdgeCtrl(edge);
    var sa = project(a.x, a.y, a.z);
    var sb = project(b.x, b.y, b.z);
    var sc = project(edge.ctrl.x, edge.ctrl.y, edge.ctrl.z);
    var depth = (sa.d + sb.d) / 2;
    var depthAlpha = clamp((5.5 - depth) / 2.2, 0.18, 1);
    var visibility = Math.min(a.alpha, b.alpha);
    var alpha = depthAlpha * (dim ? 0.14 : 1) * clamp(0.35 + visibility * 0.85, 0, 1);

    if ((sa.x < -120 && sb.x < -120) || (sa.x > width + 120 && sb.x > width + 120)) {
      return;
    }

    // 屏幕空间法向：让多条细线平行偏移，形成纤维束
    var dx = sb.x - sa.x;
    var dy = sb.y - sa.y;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;

    var rgbA = nodeColor(a);
    var rgbB = nodeColor(b);
    var grad = ctx.createLinearGradient(sa.x, sa.y, sb.x, sb.y);
    var front = 0.28 + edge.weight * 0.62;
    grad.addColorStop(0, 'rgba(' + rgbA + ',' + (front * alpha).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(' + rgbB + ',' + (front * alpha * 0.78).toFixed(3) + ')');

    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    var strands = edge.strands;
    var spread = 1.9;
    for (var i = 0; i < strands; i++) {
      var offset = (i - (strands - 1) / 2) * spread;
      var wobble = Math.sin(i * 2.1 + edge.weight * 6) * 1.1;
      ctx.lineWidth = 0.55 + edge.weight * 1.05;
      ctx.globalAlpha = (0.5 + (i === Math.floor(strands / 2) ? 0.35 : 0)) * alpha;
      ctx.beginPath();
      ctx.moveTo(sa.x + nx * offset, sa.y + ny * offset);
      ctx.quadraticCurveTo(
        sc.x + nx * (offset + wobble),
        sc.y + ny * (offset + wobble),
        sb.x + nx * offset,
        sb.y + ny * offset
      );
      ctx.stroke();
    }
    // 柔光层：宽而淡，让纤维有"发光"而非"铅笔线"的质感
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.06 + edge.weight * 0.08) * alpha;
    ctx.strokeStyle = 'rgba(' + rgbA + ',0.55)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.quadraticCurveTo(sc.x, sc.y, sb.x, sb.y);
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // 命中检测用的折线
    var points = edge.points;
    points.length = 0;
    for (var p = 0; p <= CURVE_SAMPLES; p++) {
      var curveT = p / CURVE_SAMPLES;
      var mt = 1 - curveT;
      points.push({
        x: mt * mt * sa.x + 2 * mt * curveT * sc.x + curveT * curveT * sb.x,
        y: mt * mt * sa.y + 2 * mt * curveT * sc.y + curveT * curveT * sb.y
      });
    }

    // 流动光点：沿纤维缓慢滑行，给静止画面一点生命
    for (var q = 0; q < edge.particles.length; q++) {
      var particle = edge.particles[q];
      var tt = ((time_now * particle.speed) + particle.t) % 1;
      var mt2 = 1 - tt;
      var pxw = mt2 * mt2 * a.x + 2 * mt2 * tt * edge.ctrl.x + tt * tt * b.x;
      var pyw = mt2 * mt2 * a.y + 2 * mt2 * tt * edge.ctrl.y + tt * tt * b.y;
      var pzw = mt2 * mt2 * a.z + 2 * mt2 * tt * edge.ctrl.z + tt * tt * b.z;
      var sp2 = project(pxw, pyw, pzw);
      var fade = Math.sin(tt * Math.PI);
      ctx.save();
      ctx.globalAlpha = 0.5 * alpha * fade;
      ctx.fillStyle = '#fff6ea';
      ctx.beginPath();
      ctx.arc(sp2.x, sp2.y, 1 + edge.weight * 1.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ======================= 节点 =======================

  function drawNode(node) {
    var radius = node.radius * node.scale;
    if (!(radius > 0.8)) {
      return;
    }
    var color = nodeColor(node);
    var isFocus = node === focusNode;
    var alpha = clamp(node.alpha * node.depthAlpha, 0, 1);
    if (alpha < 0.02) {
      return;
    }

    // 1. 外层辉光：用头像主色，聚焦的头像再亮一档
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (isFocus ? 0.62 : 0.42) * alpha * (0.78 + node.hoverEase * 0.55);
    var glowR = radius * (isFocus ? 3.9 : 3.2);
    var sprite = glowSprite(color);
    ctx.drawImage(sprite, node.sx - glowR, node.sy - glowR, glowR * 2, glowR * 2);
    if (node.hoverEase > 0.02) {
      ctx.globalAlpha = 0.3 * node.hoverEase;
      ctx.drawImage(sprite, node.sx - glowR * 1.9, node.sy - glowR * 1.9, glowR * 3.8, glowR * 3.8);
    }
    ctx.restore();

    // 2. 头像本体
    var entry = node.avatar;
    ctx.save();
    ctx.globalAlpha = clamp(alpha + 0.15, 0, 1);
    ctx.beginPath();
    ctx.arc(node.sx, node.sy, radius, 0, TAU);
    ctx.closePath();
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
      if (node.depth > CAM_Z) {
        ctx.fillStyle = 'rgba(4,6,12,' + clamp((node.depth - CAM_Z) * 0.3, 0, 0.5).toFixed(3) + ')';
        ctx.fillRect(node.sx - radius, node.sy - radius, radius * 2, radius * 2);
      }
    } else {
      ctx.fillStyle = 'rgba(' + color + ',0.85)';
      ctx.fillRect(node.sx - radius, node.sy - radius, radius * 2, radius * 2);
      ctx.fillStyle = 'rgba(8,10,16,0.85)';
      ctx.font = '600 ' + Math.max(9, Math.round(radius * 0.9)) + 'px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.initial || '', node.sx, node.sy + 1);
    }
    ctx.restore();

    // 3. 描边：主色光圈；聚焦时再加一圈虚焦外环，明确"我就是中心"
    ctx.save();
    ctx.globalAlpha = clamp(alpha + 0.1, 0, 1);
    ctx.beginPath();
    ctx.arc(node.sx, node.sy, radius, 0, TAU);
    ctx.strokeStyle = 'rgba(' + color + ',' + (0.7 + node.hoverEase * 0.3).toFixed(2) + ')';
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.stroke();
    ctx.restore();

    if (isFocus || node.hoverEase > 0.02) {
      ctx.save();
      ctx.globalAlpha = isFocus ? 0.55 : node.hoverEase * 0.7;
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, radius * (isFocus ? 1.55 : 1.34), 0, TAU);
      ctx.strokeStyle = 'rgba(' + color + ',0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * 头像下方的小字：成员名称，不显示学校。
   * 名称比头像宽时优先放下方，其次上方、右侧、左侧；都被占就跳过（悬停时除外）。
   */
  var labelRects = [];

  function drawLabels() {
    labelRects.length = 0;
    var ordered = nodes.slice().sort(function(a, b) {
      if (a === focusNode) return -1;
      if (b === focusNode) return 1;
      if ((a === hovered || a === focused)) return -1;
      if ((b === hovered || b === focused)) return 1;
      return b.alpha - a.alpha;
    });

    var occupied = [];
    for (var o = 0; o < nodes.length; o++) {
      var other = nodes[o];
      var r = Math.max(6, other.radius * other.scale);
      occupied.push({ node: other, x: other.sx - r, y: other.sy - r, w: r * 2, h: r * 2 });
    }

    function hits(rect, node) {
      for (var r = 0; r < labelRects.length; r++) {
        var placed = labelRects[r];
        if (rect.x < placed.x + placed.w && rect.x + rect.w > placed.x
          && rect.y < placed.y + placed.h && rect.y + rect.h > placed.y) {
          return true;
        }
      }
      for (var n = 0; n < occupied.length; n++) {
        var block = occupied[n];
        if (block.node === node) {
          continue;
        }
        if (rect.x < block.x + block.w && rect.x + rect.w > block.x
          && rect.y < block.y + block.h && rect.y + rect.h > block.y) {
          return true;
        }
      }
      return false;
    }

    for (var i = 0; i < ordered.length; i++) {
      var node = ordered[i];
      if (node.alpha < 0.24) {
        continue;
      }
      var text = node.name;
      if (!text) {
        continue;
      }
      var narrow = width < 600;
      var isFocus = node === focusNode;
      var size = clamp(node.radius * 0.34, narrow ? 10 : 11, isFocus ? 18 : 15);
      var maxLength = narrow ? 7 : 10;
      if (text.length > maxLength) {
        text = text.slice(0, maxLength - 1) + '…';
      }

      ctx.save();
      ctx.font = (isFocus ? '600 ' : '500 ') + size.toFixed(1) + 'px ' + FONT_STACK;
      var textWidth = ctx.measureText(text).width;
      var gap = Math.max(6, node.radius * node.scale) + 7;
      var rect = null;
      var x = 0;
      var y = 0;
      var candidates = [
        { x: node.sx - textWidth / 2, y: node.sy + gap + size },
        { x: node.sx - textWidth / 2, y: node.sy - gap - 1 },
        { x: node.sx + gap, y: node.sy + size * 0.34 },
        { x: node.sx - gap - textWidth, y: node.sy + size * 0.34 }
      ];
      for (var c = 0; c < candidates.length; c++) {
        var cand = candidates[c];
        if (cand.x < 10 || cand.x + textWidth > width - 10
          || cand.y < size + 8 || cand.y > height - 10) {
          continue;
        }
        var box = { x: cand.x - 3, y: cand.y - size, w: textWidth + 6, h: size * 1.4 };
        if (!hits(box, node)) {
          rect = box;
          x = cand.x;
          y = cand.y;
          break;
        }
      }
      if (!rect) {
        if (node.alpha < 0.7 && node !== focusNode) {
          ctx.restore();
          continue;
        }
        x = clamp(node.sx - textWidth / 2, 10, Math.max(10, width - textWidth - 10));
        y = clamp(node.sy + gap + size, size + 8, height - 10);
        rect = { x: x - 3, y: y - size, w: textWidth + 6, h: size * 1.4 };
      }
      labelRects.push(rect);

      var labelAlpha = clamp(node.alpha * (isFocus ? 1 : 0.88) + 0.1, 0, 1);
      ctx.globalAlpha = labelAlpha;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      // 不用 shadowBlur：它是 canvas 里最重的操作之一，全屏几十个标签每帧模糊会明显掉帧；
      // 浅色文字在深空底上本来就可读，直接纯色填充即可
      ctx.shadowBlur = 0;
      ctx.fillStyle = isFocus
        ? 'rgba(255,255,255,1)'
        : 'rgba(233,236,245,0.94)';
      ctx.fillText(text, x, y);
      ctx.restore();
    }
  }

  // ======================= 动画与主循环 =======================

  var time_now = 0;

  /** 每帧把节点朝目标位置收一点：既做布局过渡，也做"聚焦"的推拉动画 */
  function stepMotion(delta) {
    var k = clamp(delta / 190, 0.05, 1);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      node.x += (node.tx - node.x) * k;
      node.y += (node.ty - node.y) * k;
      node.z += (node.tz - node.z) * k;
      node.worldR += (node.targetR - node.worldR) * k;
      node.alpha += (node.targetAlpha - node.alpha) * k;
    }
    view.zoom += (zoomTarget - view.zoom) * k;
  }

  function draw() {
    if (!width || !height) {
      return;
    }
    var time = now();
    time_now = time;
    ctx.clearRect(0, 0, width, height);

    drawBackdrop(time);
    drawDust(time);

    for (var i = 0; i < nodes.length; i++) {
      projectNode(nodes[i]);
    }

    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k];
      var appear = 1;
      if (revealAt) {
        // 变量名不能叫 t：会遮蔽模块级的 i18n 函数 t()，星图为空时画兜底文案就会抛错
        var revealT = clamp((time - revealAt - node.delay) / REVEAL_DURATION, 0, 1);
        appear = revealT <= 0 ? 0.001 : easeOutBack(revealT);
      }
      var hoverTarget = (node === hovered || node === focused || node === focusNode) ? 1 : 0;
      if (prefersReducedMotion()) {
        node.hoverEase = hoverTarget;
      } else {
        node.hoverEase += (hoverTarget - node.hoverEase) * 0.2;
      }
      node.scale = appear * (1 + node.hoverEase * 0.12);
    }

    // 纤维：远的先画，近的后画；聚焦时只亮与中心有关的那几条
    var orderedEdges = edges.slice().sort(function(a, b) {
      return (b.a.depth + b.b.depth) - (a.a.depth + a.b.depth);
    });
    var highlight = hovered || focused || focusNode;
    for (var e = 0; e < orderedEdges.length; e++) {
      var edge = orderedEdges[e];
      var dim = false;
      if (highlight) {
        dim = edge.a !== highlight && edge.b !== highlight;
      }
      if (edge === hoveredLink) {
        continue;
      }
      if (hoveredLink) {
        dim = true;
      }
      drawEdge(edge, dim);
    }
    if (hoveredLink) {
      drawEdge(hoveredLink, false);
    }

    // 按 depth 降序绘制（远的先画、近的后画）；聚焦节点额外排到最后，保证永远不被其他成员盖住
    var orderedNodes = nodes.slice().sort(function(a, b) {
      if (a === focusNode) return 1;
      if (b === focusNode) return -1;
      return b.depth - a.depth;
    });
    for (var n = 0; n < orderedNodes.length; n++) {
      drawNode(orderedNodes[n]);
    }

    drawLabels();

    // 没有任何成员时给一句明确的空状态
    if (!nodes.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '500 14px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('network.noMatch'), width / 2, height / 2);
    }
  }

  function requestDraw() {
    if (frame) {
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

  function tick(time) {
    frame = null;
    var delta = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;

    if (!pointer.dragging) {
      if (Math.abs(spinVX) > 0.000004 || Math.abs(spinVY) > 0.000004) {
        view.yaw += spinVX * delta;
        view.pitch += spinVY * delta;
        spinVX *= 0.955;
        spinVY *= 0.955;
      } else {
        spinVX = 0;
        spinVY = 0;
      }
      if (autoSpin && !prefersReducedMotion()) {
        view.yaw += AUTO_SPIN * delta * (focusNode ? FOCUS_SPIN_RATIO : 1);
      }
      view.pitch = clamp(view.pitch, -1.05, 1.05);
    }

    stepMotion(delta);
    draw();
    if (!prefersReducedMotion()) {
      schedule();
    }
  }

  // ======================= 命中检测 =======================

  function findHovered() {
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.depth > CAM_Z + 1.0 || node.alpha < 0.22) {
        continue;
      }
      var dx = pointer.x - node.sx;
      var dy = pointer.y - node.sy;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var hit = Math.max(9, node.radius * node.scale + 6);
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

  function hideLinkTip() {
    if (linkTipEl) {
      linkTipEl.hidden = true;
    }
  }

  function findHoveredLink() {
    if (!linkPaths.length) {
      return null;
    }
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < linkPaths.length; i++) {
      var item = linkPaths[i];
      if (item.a.alpha < 0.3 || item.b.alpha < 0.3) {
        continue;
      }
      var tolerance = 4 + item.weight * 4;
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
    var segT = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    segT = segT < 0 ? 0 : (segT > 1 ? 1 : segT);
    var ex = px - (x1 + segT * dx);
    var ey = py - (y1 + segT * dy);
    return ex * ex + ey * ey;
  }

  /** 连线提示：谁和谁、哪类关联、多强、模型为什么这么判断 */
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
    pair.textContent = link.a.name + ' ↔ ' + link.b.name;
    head.appendChild(pair);
    var tag = document.createElement('em');
    tag.textContent = (CATEGORY_LABELS[link.category] || t('network.linkFallback'))
      + ' · ' + strengthLabel(strength);
    head.appendChild(tag);
    linkTipEl.appendChild(head);

    var note = document.createElement('p');
    note.className = 'member-network-link-tip-reason';
    note.textContent = link.reason
      ? link.reason
      : (link.source === 'ai' ? t('network.noDetail') : t('network.sameSchoolReason'));
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

  /** 悬停提示只写成员名称：星图上不出现学校 */
  function renderTip() {
    if (!tip) {
      return;
    }
    var target = hovered || focused;
    if (!target || !target.name) {
      hideTip();
      return;
    }
    tip.textContent = target.name;
    tip.hidden = false;
    var canvasRect = canvas.getBoundingClientRect();
    var sectionRect = section.getBoundingClientRect();
    var left = (canvasRect.left - sectionRect.left) + target.sx;
    var top = (canvasRect.top - sectionRect.top) + target.sy;
    var maxLeft = section.clientWidth - tip.offsetWidth - 8;
    tip.style.left = clamp(left - tip.offsetWidth / 2, 8, Math.max(8, maxLeft)) + 'px';
    tip.style.top = Math.max(4, top - tip.offsetHeight - 12 - target.radius) + 'px';
  }

  /**
   * 点击头像的两段式：
   * 第一次 = 以他为中心亮关系网；再点同一个 = 打开工作证。
   */
  function activateNode(node) {
    if (!node) {
      setFocus(null);
      return;
    }
    if (focusNode === node) {
      openBadge(node);
      return;
    }
    setFocus(node);
  }

  function openBadge(node) {
    if (!node || !node.card) {
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
    focal = Math.min(width, height) * FOCAL_RATIO;
    var aspect = width / Math.max(1, height);
    xStretch = clamp(1 + (aspect - 1) * 0.62, 1, 1.78);
    if (!stars.length || starSeed === 0) {
      initStars();
    }
    requestDraw();
  }

  // —— 沉浸态：进入关系网后整页切夜色，退出时恢复 ——

  /**
   * 直接落明暗主题值（不依赖 main.js 内部的 applyTheme）。
   * 只改 DOM 上的 data-theme / data-color-scheme / class，不写任何存储：
   * 主题偏好仍由用户主动操作（main.js）或服务端管理，沉浸态只是视觉上的临时覆盖，
   * 避免污染用户原始偏好、导航离开后主题错乱。
   * animate 为真时复用 main.js 的 theme-transitioning 类做整页颜色过渡。
   */
  function forceTheme(actual, animate) {
    suppressThemeWatch = true;
    var root = document.documentElement;
    if (animate && !prefersReducedMotion()) {
      root.classList.add('theme-transitioning');
      window.clearTimeout(themeTransitionTimer);
      themeTransitionTimer = window.setTimeout(function() {
        root.classList.remove('theme-transitioning');
      }, 480);
    }
    root.setAttribute('data-theme', actual);
    root.setAttribute('data-color-scheme', actual);
    root.classList.remove('light', 'dark');
    root.classList.add(actual);
    // 同步主题切换按钮的按压态（main.js 内部状态，这里手动对齐避免图标与 aria 脱节）
    var toggles = document.querySelectorAll('#themeToggle, [data-theme-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-pressed', String(actual === 'dark'));
    }
    suppressThemeWatch = false;
  }

  function enterImmersive() {
    if (immersive) {
      return;
    }
    immersive = true;
    immersivePrevTheme = document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark' : 'light';
    document.documentElement.classList.add('is-network-immersive');
    if (immersivePrevTheme !== 'dark') {
      forceTheme('dark', true);
    }
    // 沉浸态会抬高画布高度，等 CSS 生效后按新尺寸重排画布与节点投影
    window.requestAnimationFrame(function() {
      resize();
    });
  }

  // restoreTheme：退出时是否把主题恢复到进入前的值；用户手动切到白天时不恢复
  function exitImmersive(restoreTheme) {
    if (!immersive) {
      return;
    }
    immersive = false;
    document.documentElement.classList.remove('is-network-immersive');
    if (restoreTheme && immersivePrevTheme !== document.documentElement.getAttribute('data-theme')) {
      forceTheme(immersivePrevTheme, true);
    }
    window.requestAnimationFrame(function() {
      resize();
    });
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
      enterImmersive();
    } else {
      stopLoop();
      hovered = null;
      focused = null;
      hoveredLink = null;
      hideTip();
      hideLinkTip();
      replayEnter(container, 'is-grid-entering');
      exitImmersive(true);
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
    spinVX = 0;
    spinVY = 0;
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
      // 连线优先于节点：指着线问"为什么连"比指着节点更少见，命中时要先讲清楚
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
    view.yaw += dx * 0.006;
    view.pitch = clamp(view.pitch + dy * 0.004, -1.05, 1.05);
    spinVX = dx * 0.00028;
    spinVY = dy * 0.0002;
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
      var node = findHovered();
      if (node) {
        activateNode(node);
      } else {
        // 点空白 = 退出聚焦
        setFocus(null);
      }
    }
    if (prefersReducedMotion()) {
      spinVX = 0;
      spinVY = 0;
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

  on(canvas, 'wheel', function(event) {
    event.preventDefault();
    var factor = Math.exp(-event.deltaY * 0.0015);
    zoomTarget = clamp(zoomTarget * factor, MIN_ZOOM, MAX_ZOOM);
    view.zoom = zoomTarget;
    requestDraw();
    makeSureAnimating();
  }, { passive: false });

  on(canvas, 'keydown', function(event) {
    var step = 0.12;
    if (event.key === 'ArrowLeft') {
      view.yaw -= step;
    } else if (event.key === 'ArrowRight') {
      view.yaw += step;
    } else if (event.key === 'ArrowUp') {
      view.pitch = clamp(view.pitch - step * 0.6, -1.05, 1.05);
    } else if (event.key === 'ArrowDown') {
      view.pitch = clamp(view.pitch + step * 0.6, -1.05, 1.05);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateNode(hovered || focused || nodes[0]);
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setFocus(null);
      requestDraw();
      return;
    } else {
      return;
    }
    event.preventDefault();
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

  // 星图工具条：暂停/恢复自转、重置视角（同时退出聚焦）
  if (rotateBtn) {
    rotateBtn.setAttribute('aria-pressed', 'true');
    on(rotateBtn, 'click', function() {
      autoSpin = !autoSpin;
      rotateBtn.setAttribute('aria-pressed', autoSpin ? 'true' : 'false');
      rotateBtn.textContent = autoSpin ? t('members.networkRotateStop') : t('members.networkRotateStart');
      rotateBtn.classList.toggle('is-off', !autoSpin);
      if (autoSpin) {
        makeSureAnimating();
      }
    });
  }
  if (resetBtn) {
    on(resetBtn, 'click', function() {
      view.yaw = 0.42;
      view.pitch = -0.16;
      spinVX = 0;
      spinVY = 0;
      setFocus(null);
      view.zoom = 1;
      zoomTarget = 1;
      requestDraw();
      makeSureAnimating();
    });
  }

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
      // 沉浸态下用户手动切明暗：不再退回内嵌星图（全屏星图自带夜色），
      // 只把「退出时要恢复的主题」对齐成当前值，避免退出时把用户刚选的白天又翻回去。
      if (!suppressThemeWatch && immersive && active) {
        immersivePrevTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      }
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
