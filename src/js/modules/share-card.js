/**
 * 划线分享图：浏览器本地合成，不请求任何外部绘制服务。
 *
 * 构图 —— 纸上的一张「摘录卡」：顶部品牌横线，中间是被划线的段落（左侧一道红色竖线
 * 当引号用），下面是文章标题，底部二维码指向原文。逻辑画布 1080×1440（按 2 倍导出）。
 * 颜色读主题的 --primary，后台换主题色这张图会跟着变。
 */

var W = 1080;
var H = 1440;
var S = 2;

var SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
var DISPLAY = '"KuaiKanShiJieTi","Noto Serif SC","Songti SC",serif';

var PAD = 84;
var RIGHT = W - PAD;
var PAPER = '#f8f5ef';
var INK = '#241d1c';
var INK_SOFT = '#57534b';
var MUTED = '#8d8981';
var HAIRLINE = 'rgba(36,29,28,0.12)';

var QR_SIZE = 176;
var QR_TOP = 1176;
var HAIRLINE_TOP = 1140;
var QUOTE_TOP = 330;
var QUOTE_BOTTOM = HAIRLINE_TOP - 40;

/* 避头尾：这些字不能出现在行首，遇到就挤进上一行 */
var NO_LINE_START = '，。、；：？！）》」』】〕”’…—·,.;:?!)]}%';
var NO_LINE_END = '（《「『【〔“‘([{';

function primaryColor() {
  if (typeof window === 'undefined' || !window.getComputedStyle) return '#d13e43';
  var raw = window.getComputedStyle(document.documentElement).getPropertyValue('--primary');
  raw = (raw || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : '#d13e43';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* 中英混排的换行：先量宽度，再按避头尾调一次 */
function wrapText(ctx, text, maxWidth) {
  var chars = Array.from(String(text).replace(/\s+/g, ' ').trim());
  var lines = [];
  var line = '';
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    var next = line + ch;
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (NO_LINE_START.indexOf(ch) >= 0) {
      line = next;
      continue;
    }
    if (NO_LINE_END.indexOf(line.slice(-1)) >= 0) {
      var tail = line.slice(-1);
      lines.push(line.slice(0, -1));
      line = tail + ch;
      continue;
    }
    lines.push(line);
    line = ch;
  }
  if (line) lines.push(line);
  return lines;
}

/* 超出行数上限时，最后一行裁出省略号 */
function limitLines(ctx, lines, maxLines, maxWidth) {
  if (lines.length <= maxLines) return lines;
  var cut = lines.slice(0, maxLines);
  var last = cut[maxLines - 1];
  while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
    last = last.slice(0, -1);
  }
  cut[maxLines - 1] = last.replace(/[，。、；：,.;:]+$/, '') + '…';
  return cut;
}

/* 单行截断 */
function ellipsis(ctx, text, maxWidth) {
  var value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) {
    value = value.slice(0, -1);
  }
  return value + '…';
}

/* Canvas 没有 letter-spacing（Safari 至今不支持），逐字画 */
function drawSpaced(ctx, text, x, y, spacing) {
  var chars = Array.from(String(text));
  var cursor = x;
  var align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach(function (ch) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  });
  ctx.textAlign = align;
  return cursor - x;
}

function spacedWidth(ctx, text, spacing) {
  var chars = Array.from(String(text));
  var width = 0;
  chars.forEach(function (ch) { width += ctx.measureText(ch).width + spacing; });
  return Math.max(0, width - spacing);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- 二维码 ---------- */

var qrLoader = null;

function loadQrEncoder(url) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!url) return Promise.resolve(null);
  if (qrLoader) return qrLoader;
  qrLoader = new Promise(function (resolve) {
    var script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = function () { resolve(window.qrcode || null); };
    script.onerror = function () { resolve(null); };
    document.head.appendChild(script);
  });
  return qrLoader;
}

function drawQr(ctx, encoder, text, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, size, size, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(36,29,28,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  var qr = null;
  try {
    qr = encoder(0, 'M');
    qr.addData(text);
    qr.make();
  } catch (error) {
    qr = null;
  }
  if (!qr) {
    ctx.restore();
    return false;
  }
  var count = qr.getModuleCount();
  var quiet = 2;
  var cell = Math.max(2, Math.floor((size - 24) / (count + quiet * 2)));
  var span = cell * count;
  var originX = x + Math.round((size - span) / 2);
  var originY = y + Math.round((size - span) / 2);
  ctx.fillStyle = '#1f1b18';
  for (var row = 0; row < count; row++) {
    for (var col = 0; col < count; col++) {
      if (qr.isDark(row, col)) ctx.fillRect(originX + col * cell, originY + row * cell, cell, cell);
    }
  }
  ctx.restore();
  return true;
}

/* ---------- 字体 ---------- */

function whenFontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  var jobs = [];
  if (document.fonts.load) {
    jobs.push(document.fonts.load('400 40px ' + SANS.split(',')[0]).catch(function () { return null; }));
    jobs.push(document.fonts.load('400 40px KuaiKanShiJieTi').catch(function () { return null; }));
  }
  if (document.fonts.ready) {
    jobs.push(Promise.resolve(document.fonts.ready).catch(function () { return null; }));
  }
  return Promise.race([
    Promise.all(jobs),
    new Promise(function (resolve) { window.setTimeout(resolve, 1600); })
  ]);
}

/* ---------- 主构图 ---------- */

export function createShareCard(options) {
  var opts = options || {};
  var accent = primaryColor();
  var brand = opts.brand || 'NUCMA';
  var brandShort = opts.brandShort || 'NUCMA';
  var qrHint = opts.qrHint || '';
  var quote = String(opts.quote || '').trim();
  var title = String(opts.title || '').trim();
  var meta = [opts.category, opts.date].filter(Boolean).join(' · ');
  var url = opts.url || (typeof location !== 'undefined' ? location.href : '');
  /* 文章 permalink 是站内相对路径，二维码必须扫出绝对地址 */
  if (url && !/^[a-z]+:\/\//i.test(url) && typeof location !== 'undefined') {
    url = location.origin + (url.charAt(0) === '/' ? '' : '/') + url;
  }

  return Promise.all([whenFontsReady(), loadQrEncoder(opts.qrScript)])
    .then(function (results) {
      var encoder = results[1];
      var canvas = document.createElement('canvas');
      canvas.width = W * S;
      canvas.height = H * S;
      var ctx = canvas.getContext('2d');
      ctx.scale(S, S);
      ctx.textBaseline = 'alphabetic';

      /* 纸底 + 一圈极淡的内框，像裱起来的摘录卡 */
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(36,29,28,0.07)';
      ctx.lineWidth = 1;
      ctx.strokeRect(40.5, 40.5, W - 81, H - 81);

      /* 顶部品牌 */
      ctx.fillStyle = accent;
      ctx.fillRect(PAD, 96, 46, 5);
      ctx.font = '400 21px ' + SANS;
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = 'left';
      drawSpaced(ctx, brand, PAD, 148, 3.4);
      ctx.font = '400 17px ' + SANS;
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'right';
      drawSpacedRight(ctx, brandShort, RIGHT, 148, 4);

      ctx.strokeStyle = HAIRLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, 180.5);
      ctx.lineTo(RIGHT, 180.5);
      ctx.stroke();

      /* 栏目 · 日期 */
      if (meta) {
        ctx.font = '400 19px ' + SANS;
        ctx.textAlign = 'left';
        var cursor = PAD;
        if (opts.category) {
          ctx.fillStyle = accent;
          cursor += drawSpaced(ctx, opts.category, cursor, 236, 2.4);
          if (opts.date) {
            ctx.fillStyle = MUTED;
            ctx.fillText('·', cursor + 14, 236);
            cursor += 14 + ctx.measureText('·').width + 14;
          }
        }
        if (opts.date) {
          ctx.fillStyle = MUTED;
          drawSpaced(ctx, opts.date, cursor, 236, 1.2);
        }
      }

      /* 摘录正文：按长度选字号，整块在可用高度里垂直居中 */
      var quoteText = quote || title;
      var sizes = [42, 38, 34, 30];
      var maxWidth = RIGHT - (PAD + 32);
      var maxHeight = QUOTE_BOTTOM - QUOTE_TOP;
      var chosen = null;
      for (var i = 0; i < sizes.length && !chosen; i++) {
        var size = sizes[i];
        ctx.font = '400 ' + size + 'px ' + SANS;
        var lines = wrapText(ctx, quoteText, maxWidth);
        var lineHeight = Math.round(size * 1.85);
        if (lines.length * lineHeight <= maxHeight) {
          chosen = { size: size, lines: lines, lineHeight: lineHeight };
        }
      }
      if (!chosen) {
        var fallbackSize = 28;
        ctx.font = '400 ' + fallbackSize + 'px ' + SANS;
        var fitLines = limitLines(ctx, wrapText(ctx, quoteText, maxWidth), Math.floor(maxHeight / 52), maxWidth);
        chosen = { size: fallbackSize, lines: fitLines, lineHeight: 52 };
      }

      var blockHeight = chosen.lines.length * chosen.lineHeight;
      /* 顶部对齐：短摘录下方留白比「上下各空一大块」更像一张排版过的卡片 */
      var quoteTop = QUOTE_TOP;

      /* 引号竖线：比文字块略矮，两端各收 8px */
      ctx.fillStyle = accent;
      ctx.fillRect(PAD, quoteTop + 8, 4, Math.max(24, blockHeight - 16));

      ctx.font = '400 ' + chosen.size + 'px ' + SANS;
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      chosen.lines.forEach(function (line, index) {
        ctx.fillText(line, PAD + 32, quoteTop + chosen.lineHeight * index + chosen.size);
      });

      /* 出处：—— 《标题》 */
      var attrTop = quoteTop + blockHeight + 40;
      if (title) {
        ctx.font = '400 23px ' + SANS;
        ctx.fillStyle = INK_SOFT;
        var attr = '—— 《' + title + '》';
        ctx.fillText(ellipsis(ctx, attr, RIGHT - PAD), PAD, Math.min(attrTop, QUOTE_BOTTOM));

        if (opts.author) {
          ctx.font = '400 18px ' + SANS;
          ctx.fillStyle = MUTED;
          var byline = (opts.authorPrefix ? opts.authorPrefix + ' / ' : '') + opts.author;
          ctx.fillText(ellipsis(ctx, byline, RIGHT - PAD), PAD, Math.min(attrTop + 34, QUOTE_BOTTOM + 30));
        }
      }

      /* 底部：二维码 + 提示 + 网址 */
      drawQr(ctx, encoder, url, PAD, QR_TOP, QR_SIZE);

      var textLeft = PAD + QR_SIZE + 34;
      ctx.textAlign = 'left';
      ctx.font = '400 25px ' + SANS;
      ctx.fillStyle = INK;
      ctx.fillText(qrHint, textLeft, QR_TOP + 66);

      ctx.font = '400 16px ' + SANS;
      ctx.fillStyle = MUTED;
      var hostPath = url.replace(/^https?:\/\//, '');
      ctx.fillText(ellipsis(ctx, hostPath, RIGHT - textLeft), textLeft, QR_TOP + 104);

      ctx.strokeStyle = HAIRLINE;
      ctx.beginPath();
      ctx.moveTo(PAD, HAIRLINE_TOP + 0.5);
      ctx.lineTo(RIGHT, HAIRLINE_TOP + 0.5);
      ctx.stroke();

      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve({
            canvas: canvas,
            blob: blob,
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height
          });
        }, 'image/png');
      });
    });
}

function drawSpacedRight(ctx, text, right, y, spacing) {
  var width = spacedWidth(ctx, text, spacing);
  drawSpaced(ctx, text, right - width, y, spacing);
}
