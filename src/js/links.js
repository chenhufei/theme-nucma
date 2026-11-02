import { t } from './modules/i18n.js';
/**
 * 友链页专用搜索。拼音能力仅在输入拉丁字母时按需加载，避免增加全站主包。
 */
(function() {
  'use strict';

  var pinyinLoader = null;

  function loadPinyin() {
    if (!pinyinLoader) {
      pinyinLoader = import('pinyin-pro').then(function(module) { return module.pinyin; });
    }
    return pinyinLoader;
  }

  function normalize(value) {
    var text = (value || '').toString().toLowerCase();
    try { text = text.normalize('NFKC'); } catch (_) {}
    return text.replace(/\s+/g, ' ').trim();
  }

  function initLinkSearch() {
    var search = document.querySelector('[data-link-search]');
    var input = document.getElementById('linkSearchInput');
    var clearButton = search?.querySelector('[data-link-search-clear]');
    var resultRoot = document.getElementById('linkSearchResults');
    var empty = document.getElementById('linkSearchEmpty');
    var count = document.getElementById('linkSearchCount');
    // 计数徽标在页头标题右侧，与分组小标题后的数字同款
    var totalBadge = document.getElementById('linkTotalCount');
    if (!search || !input || !clearButton || !resultRoot || !empty || !count) return;

    var cards = Array.from(resultRoot.querySelectorAll('.link-card'));
    if (!cards.length) {
      search.hidden = true;
      if (totalBadge) totalBadge.hidden = true;
      return;
    }

    var groups = Array.from(resultRoot.querySelectorAll('.link-group'));
    var pinyinCache = new WeakMap();
    var revision = 0;
    var timer = null;
    var indexedCards = cards.map(function(card) {
      return {
        card: card,
        name: normalize(card.querySelector('.link-name')?.textContent),
        text: normalize([
          card.querySelector('.link-name')?.textContent,
          card.querySelector('.link-desc')?.textContent,
          card.getAttribute('href'),
        ].filter(Boolean).join(' ')),
      };
    });

    function getPinyin(item, pinyin) {
      if (pinyinCache.has(item.card)) return pinyinCache.get(item.card);
      var full = normalize(pinyin(item.name, { toneType: 'none', type: 'array' }).join(''));
      var initials = normalize(pinyin(item.name, { pattern: 'first', type: 'array' }).join(''));
      var value = full + ' ' + initials;
      pinyinCache.set(item.card, value);
      return value;
    }

    function apply(query, pinyin) {
      var visible = 0;
      indexedCards.forEach(function(item) {
        var matched = !query || item.text.includes(query);
        if (!matched && pinyin) matched = getPinyin(item, pinyin).includes(query);
        item.card.hidden = !matched;
        if (matched) visible++;
      });
      groups.forEach(function(group) {
        var groupCards = Array.from(group.querySelectorAll('.link-card'));
        var groupVisible = groupCards.filter(function(card) { return !card.hidden; }).length;
        group.hidden = groupVisible === 0;
        var groupCount = group.querySelector('.link-group-count');
        if (groupCount) groupCount.textContent = String(groupVisible);
      });
      count.textContent = query
        ? t('links.resultCount', visible, cards.length)
        : t('links.totalCountText', cards.length);
      if (totalBadge) {
        // 未搜索时只显示总数；搜索时显示「命中/总数」，一眼能看出筛掉了多少
        totalBadge.textContent = query ? visible + '/' + cards.length : String(cards.length);
        totalBadge.title = query
          ? t('links.searchHint', visible, cards.length)
          : t('links.totalCountText', cards.length);
        totalBadge.hidden = false;
      }
      clearButton.hidden = !query;
      empty.hidden = !query || visible > 0;
    }

    async function update() {
      var currentRevision = ++revision;
      var query = normalize(input.value);
      if (!query || !/^[a-z0-9]+$/i.test(query)) {
        apply(query, null);
        return;
      }
      var pinyin = null;
      try { pinyin = await loadPinyin(); } catch (_) {}
      if (currentRevision !== revision || normalize(input.value) !== query) return;
      apply(query, pinyin);
    }

    function scheduleUpdate() {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 100);
    }

    function clear() {
      input.value = '';
      revision++;
      apply('', null);
      input.focus();
    }

    input.addEventListener('input', scheduleUpdate);
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        clear();
      }
    });
    clearButton.addEventListener('click', clear);
    apply('', null);
  }

  // PluginLinks 2.5 的访客自助申请契约（全部为 POST，走 api.link.halo.run）：
  //   验证码  POST /apis/api.link.halo.run/v1alpha1/link-applications/captcha
  //           -> { challengeId, image, expiresInSeconds }
  //   提交    POST /apis/api.link.halo.run/v1alpha1/link-applications
  //           -> 201 { id, status }；失败为 ProblemResponse { title, detail, errors[] }
  // 旧实现指向 /links/apply/submit 与 /links/apply/captcha，这两个地址并不存在。
  var LINK_APPLICATION_BASE = '/apis/api.link.halo.run/v1alpha1/link-applications';
  var CAPTCHA_FIELD_MAX = 5;

  function readXsrfToken() {
    var match = /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie || '');
    return match ? decodeURIComponent(match[1]) : '';
  }

  function initOfficialLinkApplication() {
    var dialog = document.getElementById('officialLinkApplyDialog');
    var form = document.getElementById('officialLinkApplyForm');
    if (!dialog || !form) return;

    var result = document.getElementById('officialLinkApplyResult');
    var captchaImage = document.getElementById('officialLinkApplyCaptcha');
    var submitButton = form.querySelector('[type="submit"]');
    var captchaCodeInput = form.elements.namedItem('captchaCode');
    var challengeId = '';
    var submitting = false;

    function showResult(message, isError) {
      if (!result) return;
      if (!message) {
        result.hidden = true;
        result.textContent = '';
        return;
      }
      result.textContent = message;
      result.hidden = false;
      result.classList.toggle('alert-error', Boolean(isError));
      result.classList.toggle('alert-success', !isError);
    }

    function describeFailure(response) {
      return response
        .json()
        .then(function(body) {
          if (body && (body.detail || body.title)) {
            var extra = Array.isArray(body.errors) && body.errors.length
              ? '（' + body.errors.join('；') + '）'
              : '';
            return (body.detail || body.title) + extra;
          }
          return '';
        })
        .catch(function() { return ''; });
    }

    function refreshCaptcha() {
      challengeId = '';
      if (!captchaImage) return;
      captchaImage.removeAttribute('src');
      fetch(LINK_APPLICATION_BASE + '/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: '{}'
      })
        .then(function(response) {
          if (!response.ok) {
            return describeFailure(response).then(function(detail) {
              // 插件设置里「启用友链申请」默认关闭，此时后端返回 404，直接给出说明而不是空图
              showResult(response.status === 404
                ? t('links.applyDisabled')
                : (detail || t('links.captchaLoadFailed')), true);
            });
          }
          return response.json().then(function(body) {
            challengeId = body.challengeId || '';
            var image = body.image || '';
            captchaImage.src = /^data:/.test(image) ? image : 'data:image/png;base64,' + image;
            if (captchaCodeInput) captchaCodeInput.value = '';
          });
        })
        .catch(function() {
          showResult(t('links.captchaLoadFailedNet'), true);
        });
    }

    function submitApplication() {
      if (submitting) return;
      var url = (form.elements.namedItem('url')?.value || '').trim();
      var displayName = (form.elements.namedItem('displayName')?.value || '').trim();
      var code = (form.elements.namedItem('captchaCode')?.value || '').trim();
      if (!url || !displayName) {
        showResult(t('links.formRequired'), true);
        return;
      }
      if (!challengeId) {
        showResult(t('links.captchaNotReady'), true);
        return;
      }
      if (code.length !== CAPTCHA_FIELD_MAX) {
        showResult(t('links.captchaRequired'), true);
        return;
      }
      var feeds = (form.elements.namedItem('feedUrls')?.value || '')
        .split(/\r?\n/)
        .map(function(line) { return line.trim(); })
        .filter(Boolean);

      var payload = {
        url: url,
        displayName: displayName,
        logo: (form.elements.namedItem('logo')?.value || '').trim() || null,
        description: (form.elements.namedItem('description')?.value || '').trim() || null,
        email: (form.elements.namedItem('email')?.value || '').trim() || null,
        backlink: (form.elements.namedItem('backlink')?.value || '').trim() || null,
        feedUrls: feeds,
        challengeId: challengeId,
        captchaCode: code
      };

      submitting = true;
      if (submitButton) submitButton.disabled = true;
      showResult('', false);
      fetch(LINK_APPLICATION_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-XSRF-TOKEN': readXsrfToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      })
        .then(function(response) {
          if (response.ok) {
            form.reset();
            showResult(t('links.applySubmitted'), false);
            return;
          }
          return describeFailure(response).then(function(detail) {
            showResult(detail || t('links.submitFailedRetry'), true);
            refreshCaptcha();
          });
        })
        .catch(function() {
          showResult(t('links.submitFailedNet'), true);
          refreshCaptcha();
        })
        .then(function() {
          submitting = false;
          if (submitButton) submitButton.disabled = false;
        });
    }

    function openDialog() {
      showResult('', false);
      if (!dialog.open) dialog.showModal();
      refreshCaptcha();
      form.elements.namedItem('url')?.focus();
    }

    document.querySelectorAll('[data-official-link-apply-open]').forEach(function(button) {
      button.addEventListener('click', openDialog);
    });
    document.querySelectorAll('[data-official-link-apply-close]').forEach(function(button) {
      button.addEventListener('click', function() { dialog.close(); });
    });
    dialog.querySelectorAll('[data-captcha-refresh]').forEach(function(button) {
      button.addEventListener('click', refreshCaptcha);
    });
    dialog.addEventListener('click', function(event) {
      if (event.target === dialog) dialog.close();
    });
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      submitApplication();
    });
    dialog.addEventListener('close', function() {
      form.reset();
      showResult('', false);
      if (submitButton) submitButton.disabled = false;
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initLinkSearch();
    initOfficialLinkApplication();
  });
})();
