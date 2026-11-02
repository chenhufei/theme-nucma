import { t } from './i18n.js';
/**
 * QQ 加好友链接的归一化与二维码解码。
 *
 * 两个前端入口（成员页认领弹窗、?token= 认领页）与后台表单共用这一份实现，
 * 避免"某处能识别、另一处识别不了"的分裂。
 *
 * 关于二维码识别：QQ 客户端导出的加好友二维码有两种官方形态
 *   - https://qm.qq.com/q/<token>
 *   - https://qm.qq.com/cgi-bin/qm/qr?k=<token>&jump_from=webapi
 * 以前只按 /q/ 前缀判定，另一种被当成"不是 QQ 链接"直接丢掉。
 * 识别本身也做了多尺度 + 反色 + 二值化重试：手机截图里二维码常只占画面一角，
 * 原始分辨率直接喂给 jsQR 经常识别不出来。
 */

var QQ_HOST = 'qm.qq.com';

/** 新版短链：token 在路径里，必须非空 */
var SHORT_PATH_PREFIX = '/q/';

/** 旧版二维码链接：token 在查询参数 k 里，路径本身没有 token */
var QR_PATH = '/cgi-bin/qm/qr';

/**
 * 判定官方路径。
 *
 * 旧版二维码链接的路径恰好就是 /cgi-bin/qm/qr，token 放在 k 查询参数里，
 * 所以不能再要求"路径比前缀长"——那会把 QQ 客户端导出的二维码链接全部判成非法，
 * 这正是之前"扫出来了却说不是 QQ 链接"的根因。
 */
function isOfficialPath(path, query) {
  if (!path) return false;
  if (path.indexOf(SHORT_PATH_PREFIX) === 0 && path.length > SHORT_PATH_PREFIX.length) {
    return true;
  }
  if (path !== QR_PATH && path.indexOf(QR_PATH + '/') !== 0) return false;
  if (!query) return false;
  var parameters = query.split('&');
  for (var i = 0; i < parameters.length; i++) {
    if (parameters[i].indexOf('k=') === 0 && parameters[i].length > 2) return true;
  }
  return false;
}

function parseUrl(raw) {
  var value = String(raw == null ? '' : raw).trim();
  // 二维码里偶尔夹换行/空格；先按空白切掉尾巴
  value = value.split(/\s+/)[0] || '';
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    value = 'https://' + value;
  }
  try {
    return new URL(value);
  } catch (error) {
    return null;
  }
}

/**
 * 归一化 QQ 加好友链接：合法时返回规范的 https 地址，非法返回空串。
 *
 * 只放行 qm.qq.com 这一个主机，路径限定在官方分享的两种形态内，
 * 因此"放宽"的是路径判定，而不是安全边界——任意站点仍然进不来。
 * http 会被升级成 https，避免把明文链接写进公示卡片和邮件。
 */
export function normalizeQqLink(raw) {
  var url = parseUrl(raw);
  if (!url) return '';
  if (url.hostname.toLowerCase() !== QQ_HOST) return '';
  if (!isOfficialPath(url.pathname || '', url.search ? url.search.slice(1) : '')) {
    return '';
  }
  url.protocol = 'https:';
  return url.toString();
}

export function isValidQqLink(raw) {
  return normalizeQqLink(raw) !== '';
}

// 二维码图片的最长边：超过就等比缩小，jsQR 在大图上反而更容易漏判
var MAX_EDGE = 1000;
// 依次尝试的缩放比例：手机截图里的二维码往往只占画面一小块，需要放大相对尺寸
var SCALES = [1, 0.62, 0.4];

var jsQrLoader = null;
export function loadJsQR() {
  if (!jsQrLoader) {
    jsQrLoader = import('jsqr').then(function(module) {
      return module.default || module;
    });
  }
  return jsQrLoader;
}

function loadImage(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error(t('members.imageReadFailed')));
    };
    img.src = url;
  });
}

/** 灰度二值化：拍摄屏幕/纸质二维码时对比度不足，二值化往往能救回来 */
function binarize(imageData) {
  var data = imageData.data;
  var copy = new Uint8ClampedArray(data.length);
  for (var i = 0; i < data.length; i += 4) {
    var luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    var value = luma > 138 ? 255 : 0;
    copy[i] = value;
    copy[i + 1] = value;
    copy[i + 2] = value;
    copy[i + 3] = 255;
  }
  return copy;
}

function drawToCanvas(img, width, height) {
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  // 白底：png 透明区域的 RGB 是 0，直接读会把二维码当成反向图
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * 图片文件 → 二维码文本；识别不到返回空串。
 *
 * 依次尝试「原图 → 缩到 62% → 缩到 40%」，每一档都跑一次原图与一次二值化，
 * 并且允许反色（attemptBoth）。最坏情况 6 次解码，但都是在 ≤1000px 的画布上跑，
 * 实测通常在 300ms 内出结果。
 */
export async function decodeQrFromFile(file) {
  if (!file) return '';
  var img = await loadImage(file);
  var jsQR = await loadJsQR();

  var edge = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  var base = edge > MAX_EDGE ? MAX_EDGE / edge : 1;

  for (var s = 0; s < SCALES.length; s++) {
    var ratio = base * SCALES[s];
    var width = Math.max(32, Math.round((img.naturalWidth || img.width) * ratio));
    var height = Math.max(32, Math.round((img.naturalHeight || img.height) * ratio));
    var imageData = drawToCanvas(img, width, height);

    var code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;

    var binary = binarize(imageData);
    code = jsQR(binary, width, height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;
  }
  return '';
}
