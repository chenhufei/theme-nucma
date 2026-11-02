/**
 * 前端文案字典。
 *
 * 服务端在页面里输出 <script type="application/json" id="nucma-i18n">，
 * 键值来自主题 i18n properties，避免 JS 里再写一份中文。
 * 未注册的 key 原样返回，便于开发期发现遗漏。
 */
var cache = null;

function load() {
  if (cache) return cache;
  cache = {};
  var el = document.getElementById('nucma-i18n');
  if (el && el.textContent) {
    try {
      cache = JSON.parse(el.textContent) || {};
    } catch (e) {
      cache = {};
    }
  }
  return cache;
}

/**
 * 取文案并填充 {0} / {1} 占位。
 * @param {string} key i18n 键
 * @param {string|number} [a] 第一个占位值
 * @param {string|number} [b] 第二个占位值
 */
export function t(key, a, b) {
  var dict = load();
  var s = dict[key];
  if (s == null) return key;
  if (a === undefined) return s;
  return String(s).replace(/\{(\d+)\}/g, function (m, i) {
    var v = i === '0' ? a : b;
    return v == null ? m : String(v);
  });
}

/** 供 layout 内联脚本使用（不经过模块图）。 */
export function exposeGlobal() {
  window.__nucmaT = t;
}

exposeGlobal();
