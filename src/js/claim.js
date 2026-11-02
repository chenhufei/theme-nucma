/**
 * QQ 链接认领页（?token=xxx）专用脚本。
 * 二维码解码实现与成员页认领弹窗共用 modules/qq-link.js。
 */
import { t } from './modules/i18n.js';
import { defaultQqAvatar } from './modules/avatar.js';
import { normalizeQqLink, decodeQrFromFile } from './modules/qq-link.js';

(function() {
  'use strict';

  var API_BASE = '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers';
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');

  var loadingEl = document.getElementById('claimLoading');
  var errorEl = document.getElementById('claimError');
  var successEl = document.getElementById('claimSuccess');
  var formEl = document.getElementById('claimForm');
  var formElement = document.getElementById('claimFormElement');

  if (!loadingEl || !errorEl || !successEl || !formEl || !formElement) return;

  var nameInput = formEl.querySelector('#claimDisplayName');
  var schoolInput = formEl.querySelector('#claimSchool');
  var avatarPreview = formEl.querySelector('[data-claim-avatar-preview]');
  var avatarFallback = formEl.querySelector('[data-claim-avatar-fallback]');
  var submitErrorEl = formEl.querySelector('[data-submit-error]');

  var defaultAvatarUrl = '';

  function showError(title, message) {
    loadingEl.hidden = true;
    formEl.hidden = true;
    errorEl.hidden = false;
    errorEl.querySelector('[data-error-title]').textContent = title;
    errorEl.querySelector('[data-error-message]').textContent = message;
  }

  function showSuccess() {
    loadingEl.hidden = true;
    formEl.hidden = true;
    successEl.hidden = false;
  }

  /**
   * 提交阶段的错误：表单保持可见并保留用户输入，只在提交按钮上方提示。
   * 原先复用 showError() 会把整个表单隐藏且没有重试入口，填好的资料全部丢失。
   */
  function showSubmitError(message) {
    if (!submitErrorEl) return;
    submitErrorEl.textContent = message || t('claim.submitFailedRetry');
    submitErrorEl.hidden = false;
  }

  function clearSubmitError() {
    if (!submitErrorEl) return;
    submitErrorEl.hidden = true;
    submitErrorEl.textContent = '';
  }

  function showForm(memberInfo) {
    loadingEl.hidden = true;
    errorEl.hidden = true;
    formEl.hidden = false;

    formEl.querySelector('[data-member-qq]').textContent = memberInfo.qq || '-';
    nameInput.value = memberInfo.displayName || '';
    schoolInput.value = memberInfo.school || '';

    defaultAvatarUrl = defaultQqAvatar(memberInfo.qq);
    // 头像只读：统一使用 QQ 头像，资料里残留的自定义头像不再展示
    setAvatarPreview(defaultAvatarUrl);

    initQrUpload();
  }

  async function fetchMemberInfo(claimToken) {
    var response = await fetch(API_BASE + '/claim/' + encodeURIComponent(claimToken), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      var error = await response.json().catch(function() { return { message: t('claim.requestFailed') }; });
      throw new Error(error.message || ('HTTP ' + response.status));
    }
    return await response.json();
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

  async function submitClaim(claimToken, profile) {
    var payload = {
      qqFriendLink: profile.qqFriendLink,
      displayName: profile.displayName,
      school: profile.school
    };

    var response = await fetch(API_BASE + '/claim/' + encodeURIComponent(claimToken), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      var error = await response.json().catch(function() { return { message: t('claim.submitFailed') }; });
      throw new Error(error.message || ('HTTP ' + response.status));
    }
    return await response.json();
  }

  function initQrUpload() {
    var btn = formEl.querySelector('[data-qr-upload-btn]');
    var input = formEl.querySelector('[data-qr-input]');
    var status = formEl.querySelector('[data-qr-status]');
    var linkInput = formEl.querySelector('#qqFriendLink');
    if (!btn || !input || !linkInput) return;

    btn.addEventListener('click', function() { input.click(); });

    input.addEventListener('change', async function(e) {
      var file = e.target.files[0];
      if (!file) return;

      if (status) {
        status.textContent = t('members.qrParsing');
        status.style.color = '';
      }

      try {
        var decoded = await decodeQrFromFile(file);
        var normalized = normalizeQqLink(decoded);
        if (status) {
          if (normalized) {
            linkInput.value = normalized;
            status.textContent = t('members.qrSuccess');
            status.style.color = '#10b981';
          } else if (decoded) {
            status.textContent = t('members.qrNotQq');
            status.style.color = '#ef4444';
          } else {
            status.textContent = t('members.qrNoCode');
            status.style.color = '#ef4444';
          }
        }
      } catch (err) {
        if (status) {
          status.textContent = t('members.qrRetry');
          status.style.color = '#ef4444';
        }
      }

      input.value = '';
      setTimeout(function() { if (status) status.textContent = ''; }, 4000);
    });
  }

  if (!token) {
    showError(t('claim.missingToken'), t('claim.missingTokenHint'));
    return;
  }

  loadingEl.hidden = false;

  fetchMemberInfo(token)
    .then(function(memberInfo) {
      if (memberInfo.qqFriendLink) {
        showError(t('claim.already'), t('claim.alreadyHint'));
      } else {
        showForm(memberInfo);
      }
    })
    .catch(function(error) {
      showError(t('claim.invalid'), error.message || t('claim.invalidHint'));
    });

  formElement.addEventListener('submit', async function(e) {
    e.preventDefault();

    var submitButton = formElement.querySelector('[data-submit-button]');
    var submitText = formElement.querySelector('[data-submit-text]');
    var submitLoading = formElement.querySelector('[data-submit-loading]');
    var linkInput = formElement.querySelector('#qqFriendLink');
    var qqFriendLink = normalizeQqLink(linkInput.value);
    var displayName = nameInput.value.trim();
    var school = schoolInput.value.trim();

    if (!displayName) {
      nameInput.focus();
      return;
    }

    if (!qqFriendLink) {
      var linkStatus = formElement.querySelector('[data-qr-status]');
      if (linkStatus) {
        linkStatus.textContent = t('members.linkInvalid');
        linkStatus.style.color = '#ef4444';
      }
      linkInput.focus();
      return;
    }
    linkInput.value = qqFriendLink;

    submitButton.disabled = true;
    submitText.hidden = true;
    submitLoading.hidden = false;
    clearSubmitError();

    try {
      await submitClaim(token, {
        qqFriendLink: qqFriendLink,
        displayName: displayName,
        school: school
      });
      showSuccess();
    } catch (error) {
      // 保留表单与已填内容，仅提示失败原因，用户可直接重试
      showSubmitError(error && error.message ? error.message : t('claim.submitFailedRetry'));
    } finally {
      submitButton.disabled = false;
      submitText.hidden = false;
      submitLoading.hidden = true;
    }
  });
})();
