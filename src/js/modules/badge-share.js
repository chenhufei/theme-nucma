/**
 * 成员工牌分享图：浏览器本地合成，不请求任何外部绘制服务。
 * 构图 —— 左侧吊带工牌（正面），右侧成员档案，右下角 NUCMA 字标；
 * 底色沿用工牌背面的奶白亚克力，逻辑画布 1480×1067（输出 2960×2134）。
 */
import { t } from './i18n.js';

var W = 1480;
var H = 1067;
var S = 2;

var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
var DISPLAY = '"KuaiKanShiJieTi","Noto Serif SC","Songti SC",serif';

var CARD_W = 470;
var CARD_H = 732;
var CARD_LEFT = 118;
var CARD_TOP = 208;
var CARD_K = CARD_W / 316;                  /* 网页卡扣 SVG 的 viewBox 比例 */
var CARD_CX = CARD_LEFT + CARD_W / 2;
var CARD_HOLE = 20.5 * CARD_K;              /* 卡孔中心（卡面局部坐标） */
var HOLE_Y = CARD_TOP + CARD_HOLE;
/* 织带终点：网页里是卡孔下方 17 + 17.3（夹片中段），换算到卡顶上方 34.3 */
var MOUTH_Y = CARD_TOP - 34.3 * CARD_K;
var BAND_W = 26 * CARD_K;                   /* 网页织带 26/316 卡宽 */

var INK = '#241d1c';
var RED = '#b13236';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amt) {
  var h = String(hex || '#cf3538').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (isNaN(n) || h.length !== 6) return hex || '#cf3538';
  function f(v) {
    return Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  }
  return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}

function setFont(ctx, size, weight, family, spacing) {
  ctx.font = weight + ' ' + size + 'px ' + family;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (spacing || 0) + 'px';
}

function joinTs(v) {
  var raw = String(v == null ? '' : v).trim();
  if (!raw) return '';
  var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '.' + m[2] + '.' + m[3];
  var d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0');
  }
  return raw;
}

function clampText(ctx, text, maxW) {
  var s = String(text || '');
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

/* 图片必须走 blob 再交给 <img>：跨域头像/Logo 若拿不到 CORS 就静默退回字形，
   绝不把未授权的图片画进画布（否则 toBlob 会因画布被污染而失败）。
   外链头像不可达时最多等 4s，不能把「保存」按钮一直卡在生成中。 */
function loadImage(url) {
  if (!url) return Promise.resolve(null);
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function() { if (ctrl) ctrl.abort(); }, 4000);
  return fetch(url, { mode: 'cors', credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined })
    .then(function(res) { return res.ok ? res.blob() : null; })
    .then(function(blob) {
      clearTimeout(timer);
      if (!blob) return null;
      return new Promise(function(resolve) {
        var href = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function() { URL.revokeObjectURL(href); resolve(img); };
        img.onerror = function() { URL.revokeObjectURL(href); resolve(null); };
        img.src = href;
      });
    })
    .catch(function() { clearTimeout(timer); return null; });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function(resolve) { setTimeout(resolve, ms); })
  ]);
}

function drawCover(ctx, img, x, y, w, h) {
  if (!img) return;
  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  var k = Math.max(w / iw, h / ih);
  var dw = iw * k;
  var dh = ih * k;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawContain(ctx, img, x, y, w, h) {
  if (!img) return;
  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  var k = Math.min(w / iw, h / ih);
  var dw = iw * k;
  var dh = ih * k;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/* ---------------- 背景：工牌背面的奶白亚克力 ---------------- */
function drawBackdrop(ctx) {
  var bg = ctx.createLinearGradient(0, 0, W * 0.32, H);
  bg.addColorStop(0, '#fdf9f6');
  bg.addColorStop(0.46, '#faf4ef');
  bg.addColorStop(1, '#f6ebe5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  var sheen = ctx.createLinearGradient(0, 0, 0, H * 0.38);
  sheen.addColorStop(0, 'rgba(255,255,255,.62)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H * 0.38);

  var warm = ctx.createRadialGradient(W * 0.96, H * 1.04, 0, W * 0.96, H * 1.04, W * 0.62);
  warm.addColorStop(0, 'rgba(221,51,51,.10)');
  warm.addColorStop(0.62, 'rgba(221,51,51,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  var cool = ctx.createRadialGradient(W * 0.06, -H * 0.06, 0, W * 0.06, -H * 0.06, W * 0.5);
  cool.addColorStop(0, 'rgba(255,255,255,.6)');
  cool.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------- 吊带 ----------------
   与网页同一套几何：带宽 26/316，卡孔 → 横杆 17、横杆 → 夹口中段 17.3，
   带端插进金属夹片里面（MOUTH_Y），由卡扣 SVG 盖住断口。
   卡片摆正后带子也是直的；上端直接出画，织带字允许被顶边裁掉一部分。 */
function drawStrap(ctx, base) {
  var x = CARD_CX;
  var hw = BAND_W / 2;
  var top = -80;
  var bottom = MOUTH_Y;
  var i;

  var grad = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
  grad.addColorStop(0, shade(base, 0.14));
  grad.addColorStop(0.45, base);
  grad.addColorStop(1, shade(base, -0.24));
  ctx.fillStyle = grad;
  ctx.fillRect(x - hw, top, BAND_W, bottom - top);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - hw, top, BAND_W, bottom - top);
  ctx.clip();
  /* 中心光泽：让带子像织物不是纸片 */
  ctx.strokeStyle = 'rgba(255,214,210,.16)';
  ctx.lineWidth = BAND_W * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  /* 织物斜纹 */
  ctx.strokeStyle = 'rgba(70,8,8,.07)';
  ctx.lineWidth = 1;
  for (var yy = top; yy < bottom; yy += 9) {
    ctx.beginPath();
    ctx.moveTo(x - hw, yy);
    ctx.lineTo(x + hw, yy + 26);
    ctx.stroke();
  }
  ctx.restore();

  /* 两侧压边 */
  ctx.strokeStyle = 'rgba(74,10,10,.34)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - hw + 0.9, top);
  ctx.lineTo(x - hw + 0.9, bottom);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.26)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + hw - 0.6, top);
  ctx.lineTo(x + hw - 0.6, bottom);
  ctx.stroke();

  /* 空心 NUCMA：字号与网页一致（带宽 60% 为字高），底部贴住夹口 */
  ctx.font = '400 100px ' + DISPLAY;
  var cap = ctx.measureText('N').actualBoundingBoxAscent || 72;   /* 100px 时的大写字高 */
  var fs = 100 * (BAND_W * 0.60) / cap;
  setFont(ctx, fs, 400, DISPLAY, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.97)';
  ctx.lineWidth = Math.max(1.15, fs * 0.058);

  var word = 'NUCMA';
  var widths = [];
  var sum = 0;
  for (i = 0; i < word.length; i++) {
    widths[i] = ctx.measureText(word[i]).width;
    sum += widths[i];
  }
  var runW = 118 * CARD_K;                     /* 网页静息时整词弧长 118，按卡宽换算 */
  var end = bottom - 16;
  var pos = end - runW;
  var gap = (runW - sum) / (word.length - 1);
  for (i = 0; i < word.length; i++) {
    var m = ctx.measureText(word[i]);
    ctx.save();
    ctx.translate(x, pos + widths[i] / 2);
    ctx.rotate(Math.PI / 2);
    ctx.strokeText(word[i], 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    ctx.restore();
    pos += widths[i] + gap;
  }
}

/* ---------------- 工牌正面 ---------------- */
function drawCard(ctx, data) {
  var pad = 18;
  var off = document.createElement('canvas');
  off.width = (CARD_W + pad * 2) * S;
  off.height = (CARD_H + pad * 2) * S;
  var c = off.getContext('2d');
  c.scale(S, S);
  c.translate(pad, pad);

  var stubY = CARD_H * 0.623;

  c.save();
  rr(c, 0, 0, CARD_W, CARD_H, 30);
  c.clip();

  var body = c.createLinearGradient(CARD_W * 0.18, 0, CARD_W * 0.84, CARD_H);
  body.addColorStop(0, '#932026');
  body.addColorStop(0.24, '#a72b2d');
  body.addColorStop(0.51, '#b23233');
  body.addColorStop(0.77, '#aa2c2f');
  body.addColorStop(1, '#992528');
  c.fillStyle = body;
  c.fillRect(0, 0, CARD_W, CARD_H);

  var glow = c.createRadialGradient(CARD_W * 0.86, -CARD_H * 0.08, 0, CARD_W * 0.86, -CARD_H * 0.08, CARD_W * 0.8);
  glow.addColorStop(0, 'rgba(255,206,199,.13)');
  glow.addColorStop(0.62, 'rgba(255,206,199,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, CARD_W, CARD_H);

  var dark = c.createRadialGradient(0, CARD_H * 1.04, 0, 0, CARD_H * 1.04, CARD_W * 0.74);
  dark.addColorStop(0, 'rgba(104,12,16,.16)');
  dark.addColorStop(0.7, 'rgba(104,12,16,0)');
  c.fillStyle = dark;
  c.fillRect(0, 0, CARD_W, CARD_H);

  /* 玻璃斜光 */
  c.fillStyle = 'rgba(255,255,255,.11)';
  c.beginPath();
  c.moveTo(CARD_W * 0.24, 0);
  c.lineTo(CARD_W * 0.37, 0);
  c.lineTo(CARD_W * 0.1, CARD_H);
  c.lineTo(0, CARD_H);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.06)';
  c.beginPath();
  c.moveTo(CARD_W * 0.63, 0);
  c.lineTo(CARD_W * 0.7, 0);
  c.lineTo(CARD_W * 0.57, CARD_H);
  c.lineTo(CARD_W * 0.52, CARD_H);
  c.closePath();
  c.fill();

  /* 顶部字标 */
  var topY = 61;
  c.fillStyle = '#fffdfc';
  c.beginPath();
  c.arc(35, topY, 5.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(90,10,12,.28)';
  c.lineWidth = 1;
  c.stroke();
  setFont(c, 14.3, 800, SANS, 3.2);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(255,255,255,.95)';
  c.fillText('MEMBERS PASS', 48, topY + 5);

  var status = data.status || t('members.verified');
  setFont(c, 12, 800, SANS, 1.6);
  var statusW = c.measureText(status).width;
  c.fillStyle = data.verified ? '#ffecc2' : 'rgba(255,255,255,.8)';
  c.beginPath();
  c.arc(CARD_W - 22 - statusW - 10, topY + 0.5, 2.8, 0, Math.PI * 2);
  c.fill();
  c.textAlign = 'right';
  c.fillText(status, CARD_W - 22, topY + 5);

  /* 头像 */
  var acx = CARD_W / 2;
  var acy = 170;
  var ar = 68;
  c.fillStyle = 'rgba(255,255,255,.94)';
  c.beginPath();
  c.arc(acx, acy, ar, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(acx, acy, ar - 4, 0, Math.PI * 2);
  c.clip();
  if (data.avatar) {
    drawCover(c, data.avatar, acx - ar + 4, acy - ar + 4, (ar - 4) * 2, (ar - 4) * 2);
  } else {
    c.fillStyle = 'rgba(132,22,26,.72)';
    c.fillRect(acx - ar, acy - ar, ar * 2, ar * 2);
    setFont(c, 62, 400, DISPLAY, 0);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText((data.name || 'N').charAt(0), acx, acy + 2);
  }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.92)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(acx, acy, ar - 1.5, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.16)';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(acx, acy, ar + 6, 0, Math.PI * 2);
  c.stroke();

  /* 姓名 / 学校 / 分组 */
  var name = data.name || 'NUCMA';
  var nameSize = 40;
  c.textBaseline = 'alphabetic';
  setFont(c, nameSize, 400, DISPLAY, 0);
  while (nameSize > 24 && c.measureText(name).width > CARD_W * 0.84) {
    nameSize -= 2;
    setFont(c, nameSize, 400, DISPLAY, 0);
  }
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.shadowColor = 'rgba(90,6,8,.32)';
  c.shadowBlur = 10;
  c.shadowOffsetY = 2;
  c.fillStyle = '#fff';
  c.fillText(name, acx, 313);
  c.shadowColor = 'transparent';
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;

  var school = data.school || '';
  if (school) {
    setFont(c, 15.5, 700, SANS, 1.4);
    c.fillStyle = 'rgba(255,255,255,.78)';
    c.fillText(clampText(c, school, CARD_W * 0.8), acx, 344);
  }

  var group = data.group || '';
  if (group) {
    setFont(c, 13, 800, SANS, 1.1);
    var gw = Math.min(c.measureText(group).width + 30, CARD_W * 0.76);
    var gh = 34;
    var gy = 365;
    rr(c, acx - gw / 2, gy, gw, gh, 17);
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.38)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#fff';
    c.fillText(clampText(c, group, gw - 24), acx, gy + 23);
  }

  /* 中段空心字，被票根切掉一截 */
  c.save();
  c.beginPath();
  c.rect(0, 0, CARD_W, stubY);
  c.clip();
  setFont(c, 65, 400, DISPLAY, 5);
  c.textAlign = 'center';
  c.globalAlpha = 0.42;
  c.strokeStyle = 'rgba(255,255,255,.44)';
  c.lineWidth = 1.8;
  c.strokeText('NUCMA', acx, stubY + 4);
  c.restore();

  /* 奶白票根 */
  c.fillStyle = '#fffaf6';
  c.fillRect(0, stubY, CARD_W, CARD_H - stubY);
  c.setLineDash([5, 6]);
  c.strokeStyle = 'rgba(180,40,44,.55)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(25, stubY + 1);
  c.lineTo(CARD_W - 25, stubY + 1);
  c.stroke();
  c.setLineDash([]);

  var qs = 172;
  var qx = (CARD_W - qs) / 2;
  var qy = stubY + 33;
  c.fillStyle = '#fff';
  rr(c, qx - 6, qy - 6, qs + 12, qs + 12, 12);
  c.fill();
  c.strokeStyle = 'rgba(196,140,132,.32)';
  c.lineWidth = 1;
  c.stroke();
  if (data.qr && data.link) {
    c.drawImage(data.qr, qx, qy, qs, qs);
  } else {
    c.save();
    c.beginPath();
    c.rect(qx, qy, qs, qs);
    c.clip();
    c.strokeStyle = 'rgba(177,50,54,.5)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(qx + qs / 2, qy + qs / 2, qs * 0.36, 0, Math.PI * 2);
    c.stroke();
    setFont(c, 66, 400, DISPLAY, 0);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = RED;
    c.fillText('NU', qx + qs / 2, qy + qs / 2 - 4);
    setFont(c, 10, 800, SANS, 2.4);
    c.fillStyle = 'rgba(177,50,54,.7)';
    c.fillText('NUCMA', qx + qs / 2, qy + qs / 2 + 40);
    c.restore();
  }

  setFont(c, 12, 800, SANS, 3.4);
  c.textAlign = 'center';
  c.fillStyle = 'rgba(150,70,64,.55)';
  c.fillText(clampText(c, data.siteTitle || 'NUCMA', CARD_W * 0.86), CARD_W / 2, CARD_H - 32);
  c.restore();

  /* 内沿高光：只留一圈极淡的边，别在卡顶堆出白条
     （原来这里还额外画了一条 2px 纯白直线，顶部会变成一道明显亮带） */
  rr(c, 0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 29.2);
  c.strokeStyle = 'rgba(255,255,255,.2)';
  c.lineWidth = 1.2;
  c.stroke();

  /* 打孔：清成透明，主画布上透出奶白底 */
  c.globalCompositeOperation = 'destination-out';
  rr(c, CARD_W * 0.5 - 14.85, CARD_HOLE - 6.7, 29.7, 13.4, 6.7);
  c.fill();
  c.globalCompositeOperation = 'source-over';

  return { canvas: off, pad: pad };
}

/* 卡扣直接复用页面里的 #claspWrap：同一份金属 SVG，
   孔沿、横杆、夹口和织带插入的位置与网页逐像素一致。 */
var CLASP_TOP = 85;   /* SVG 视口向上扩出的空间（夹片在卡顶以上） */

function drawClasp(ctx, img) {
  if (!img) return;
  ctx.drawImage(img, CARD_LEFT, CARD_TOP - CLASP_TOP * CARD_K, CARD_W, (492 + CLASP_TOP) * CARD_K);
}

function loadSvgImage(svg) {
  if (!svg) return Promise.resolve(null);
  var clone = svg.cloneNode(true);
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  /* 网页里 .clasp 有 overflow:visible，夹片画在 viewBox 之上；
     转成图片后把视口向上扩 85，否则金属夹会被裁掉。 */
  clone.setAttribute('viewBox', '0 -' + CLASP_TOP + ' 316 ' + (492 + CLASP_TOP));
  clone.setAttribute('width', '316');
  clone.setAttribute('height', String(492 + CLASP_TOP));
  var markup = new XMLSerializer().serializeToString(clone);
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { resolve(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  });
}

/* ---------------- 右下落款：logo + 站名 ---------------- */
function drawFooterBrand(ctx, data) {
  var right = W - 140;
  var box = 72;
  var gap = 18;
  var title = data.siteTitle || 'NUCMA';

  var fontSize = 34;
  setFont(ctx, fontSize, 800, SANS, 0.4);
  while (ctx.measureText(title).width > 520 && title.length > 2) {
    fontSize -= 1;
    setFont(ctx, fontSize, 800, SANS, 0.4);
  }
  var tw = ctx.measureText(title).width;
  var tx = right - tw;
  var bx = tx - gap - box;
  var by = CARD_TOP + CARD_H - box;
  var centerY = by + box / 2;

  /* 标题以 logo 的垂直中线为基准：拿实际墨迹的上下沿算基线，
     纯拉丁「NUCMA」和中英混排「NUCMA 本地开发」都不会一高一低。
     （原来的固定 +12 只对上大写字母，汉字会明显偏上。）
     注意：actualBoundingBox* 是相对「当前对齐点」量的，所以必须先声明
     用 alphabetic 基线再测，否则拿到的是上一步遗留下来的 middle/top。 */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  var metrics = ctx.measureText(title);
  var asc = metrics.actualBoundingBoxAscent;
  var desc = metrics.actualBoundingBoxDescent;
  var base = (typeof asc === 'number' && typeof desc === 'number')
    ? centerY + (asc - desc) / 2
    : centerY + fontSize * 0.34;

  ctx.save();
  ctx.shadowColor = 'rgba(90,30,24,.12)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  rr(ctx, bx, by, box, box, 18);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(36,29,28,.08)';
  ctx.lineWidth = 1;
  rr(ctx, bx, by, box, box, 18);
  ctx.stroke();

  if (data.logo) {
    ctx.save();
    rr(ctx, bx + 3, by + 3, box - 6, box - 6, 15);
    ctx.clip();
    drawContain(ctx, data.logo, bx + 9, by + 9, box - 18, box - 18);
    ctx.restore();
  } else {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(bx + box / 2, by + box / 2, box * 0.34, 0, Math.PI * 2);
    ctx.fill();
    setFont(ctx, 32, 400, DISPLAY, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('N', bx + box / 2, by + box / 2 + 1);
  }

  /* 占位分支会把 ctx.font 改成 32px 快看体，这里必须按标题自己的字号重设一次：
     否则「量的是 34px 黑体、画的是 32px 快看体」，基线怎么算都对不上。 */
  setFont(ctx, fontSize, 800, SANS, 0.4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.fillText(title, tx, base);
}

function drawProfile(ctx, data) {
  var rx = 700;
  var rw = W - 80 - rx;

  /* 眉标：顶边与卡片齐平，字号放大一档 */
  var eyeY = CARD_TOP + 48;
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(rx + 5, eyeY - 6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  setFont(ctx, 18, 800, SANS, 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(36,29,28,.44)';
  ctx.fillText('MEMBERS PASS', rx + 24, eyeY);
  var ex = rx + 24 + ctx.measureText('MEMBERS PASS').width + 22;
  ctx.strokeStyle = 'rgba(36,29,28,.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ex + 0.5, eyeY - 20);
  ctx.lineTo(ex + 0.5, eyeY + 3);
  ctx.stroke();
  setFont(ctx, 20, 800, SANS, 2.6);
  ctx.fillStyle = RED;
  ctx.fillText(t('members.badgeShareTitle'), ex + 18, eyeY);

  /* 姓名：与眉标拉开距离 */
  var name = data.name || 'NUCMA';
  var size = 96;
  setFont(ctx, size, 400, DISPLAY, 1.5);
  while (size > 44 && ctx.measureText(name).width > rw) {
    size -= 3;
    setFont(ctx, size, 400, DISPLAY, 1.5);
  }
  ctx.fillStyle = INK;
  ctx.fillText(name, rx, CARD_TOP + 196);

  /* 分隔线：原来学校 / 分组的位置直接换成 hr */
  var ruleY = CARD_TOP + 262;
  var rule = ctx.createLinearGradient(rx, ruleY, W - 80, ruleY);
  rule.addColorStop(0, 'rgba(36,29,28,.16)');
  rule.addColorStop(1, 'rgba(36,29,28,0)');
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx, ruleY + 0.5);
  ctx.lineTo(W - 80, ruleY + 0.5);
  ctx.stroke();

  /* 三行档案：标签在左，值右对齐；行首竖条同成员页标题 */
  var rows = [
    ['QQ', data.qq || '—'],
    [t('members.badgeJoined'), joinTs(data.joined) || '—'],
    [t('members.badgeShareSchool'), data.school || '—']
  ];
  var y0 = ruleY + 76;
  var i;
  for (i = 0; i < rows.length; i++) {
    var by = y0 + i * 88;
    drawStripMark(ctx, rx, by);
    var label = rows[i][0];
    setFont(ctx, 31, 800, SANS, 0.6);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(36,29,28,.44)';
    ctx.fillText(label, rx + 24, by);
    var valueX = rx + 24 + ctx.measureText(label).width + 40;
    var avail = W - 80 - valueX;

    var value = String(rows[i][1]);
    var vs = 31;
    setFont(ctx, vs, 800, SANS, 0.4);
    while (vs > 22 && ctx.measureText(value).width > avail) {
      vs -= 1;
      setFont(ctx, vs, 800, SANS, 0.4);
    }
    ctx.fillStyle = INK;
    ctx.fillText(clampText(ctx, value, avail), valueX, by);
  }
}

/* 成员页标题左侧的小竖条：4px 圆角、红→浅红渐变、外圈 2px 淡红光晕 */
function drawStripMark(ctx, x, baseline) {
  var w = 5;
  var h = 34;
  var top = baseline - 26;
  rr(ctx, x - 2.5, top - 2.5, w + 5, h + 5, 5);
  ctx.fillStyle = 'rgba(209,62,67,.1)';
  ctx.fill();
  var g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, '#d13e43');
  g.addColorStop(1, '#f09090');
  rr(ctx, x, top, w, h, 3);
  ctx.fillStyle = g;
  ctx.fill();
}

/* 与页脚 style33 的 .l-wm 同款：快看世界体、字心镂空、只留 1.5px 红描边 */
function drawWordmark(ctx) {
  setFont(ctx, 160, 400, DISPLAY, -2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = 'rgba(221,51,51,.16)';
  ctx.lineWidth = 1.9;
  ctx.strokeText('NUCMA', W - 56, H - 18);
}

export function renderBadgeShare(data) {
  data = data || {};
  var fontLoad = document.fonts && document.fonts.load
    ? withTimeout(document.fonts.load('400 64px KuaiKanShiJieTi').catch(function() { return null; }), 1500)
    : Promise.resolve();
  var fontsReady = document.fonts && document.fonts.ready
    ? withTimeout(document.fonts.ready.catch(function() { return null; }), 1500)
    : Promise.resolve();
  var tasks = [
    fontLoad,
    fontsReady,
    loadImage(data.avatar),
    loadImage(data.logo),
    loadSvgImage(document.getElementById('claspWrap'))
  ];
  return Promise.all(tasks.map(function(p) { return p || Promise.resolve(); }))
    .then(function(res) {
      var avatar = res[2] || null;
      var logo = res[3] || null;
      var clasp = res[4] || null;

      var canvas = document.createElement('canvas');
      canvas.width = W * S;
      canvas.height = H * S;
      var ctx = canvas.getContext('2d');
      ctx.scale(S, S);

      drawBackdrop(ctx);
      drawStrap(ctx, data.strapColor || '#cf3538');

      var card = drawCard(ctx, {
        name: data.name,
        school: data.school,
        group: data.group,
        qq: data.qq,
        link: data.link,
        status: data.status,
        verified: data.verified,
        siteTitle: data.siteTitle,
        avatar: avatar,
        qr: data.qr
      });

      ctx.save();
      ctx.shadowColor = 'rgba(140,18,18,.3)';
      ctx.shadowBlur = 56;
      ctx.shadowOffsetY = 30;
      ctx.drawImage(card.canvas, CARD_LEFT - card.pad, CARD_TOP - card.pad,
        CARD_W + card.pad * 2, CARD_H + card.pad * 2);
      ctx.restore();

      drawClasp(ctx, clasp);
      drawProfile(ctx, data);
      drawFooterBrand(ctx, { logo: logo, siteTitle: data.siteTitle });
      drawWordmark(ctx);

      return new Promise(function(resolve, reject) {
        canvas.toBlob(function(blob) {
          if (blob) resolve(blob);
          else reject(new Error('badge share encode failed'));
        }, 'image/png');
      });
    });
}
