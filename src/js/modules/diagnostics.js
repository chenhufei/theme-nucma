import { t } from './i18n.js';
function debugEnabled() {
  return window.NUCMA_RUNTIME && window.NUCMA_RUNTIME.debug === true;
}

function collectContractWarnings() {
  var warnings = [];
  if (!document.querySelector('main')) warnings.push(t('diagnostics.noMain'));
  if (!document.querySelector('h1')) warnings.push(t('diagnostics.noH1'));
  if (!document.querySelector('link[rel="canonical"]')) warnings.push(t('diagnostics.noCanonical'));

  document.querySelectorAll('[data-plugin-status="missing"]').forEach(function(element) {
    warnings.push(t('diagnostics.pluginMissing', element.dataset.plugin || 'unknown'));
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
    console.warn('[nucma] page contract check', warnings);
  } else {
    console.info('[nucma] page contract check passed');
  }
}
