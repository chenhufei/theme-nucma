function debugEnabled() {
  return window.NUCMA_RUNTIME && window.NUCMA_RUNTIME.debug === true;
}

function collectContractWarnings() {
  var warnings = [];
  if (!document.querySelector('main')) warnings.push('缺少 main 语义区域');
  if (!document.querySelector('h1')) warnings.push('当前页面缺少 H1');
  if (!document.querySelector('link[rel="canonical"]')) warnings.push('当前页面缺少 canonical');

  document.querySelectorAll('[data-plugin-status="missing"]').forEach(function(element) {
    warnings.push('依赖插件未启用：' + (element.dataset.plugin || 'unknown'));
  });

  return warnings;
}

export function initDiagnostics() {
  if (!debugEnabled()) return;

  var runtime = window.NUCMA_RUNTIME || {};
  var context = {
    version: runtime.version || document.body.dataset.themeVersion || 'unknown',
    template: document.body.dataset.template || 'custom',
    path: window.location.pathname
  };
  var warnings = collectContractWarnings();

  console.info('[NUCMA]', context);
  if (warnings.length) {
    console.warn('[NUCMA] 页面契约检查', warnings);
  } else {
    console.info('[NUCMA] 页面契约检查通过');
  }
}
