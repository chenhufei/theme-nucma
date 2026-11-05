/**
 * 正文划线 + 划词分享（无需登录）。
 *
 * 仿公众号的做法：选中正文 → 浮出小工具条 → 划线 / 取消划线 / 分享；
 * 划过的地方再点一下，同样浮出工具条。划线记录按文章路径存在浏览器本地
 * （localStorage），后台关掉开关后整块不初始化，旧记录也不再渲染。
 *
 * 位置用「正文纯文本偏移量」存，不用 XPath —— 主题改版、图片重新排版都不会错位；
 * 渲染时把一个范围拆成若干个 .hl-mark（同一 data-hl-id），
 * 这样跨段落、跨图片的划线也不会破坏原有结构。
 */
import { createShareCard } from './share-card.js';

var KEY_PREFIX = 'nucma.hl.v1:';
var MAX_MARKS = 200;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function initHighlight() {
  var article = document.querySelector('.post-main');
  var content = document.querySelector('.post-content.prose');
  var toolbar = document.getElementById('hlToolbar');
  if (!article || !content || !toolbar) return;
  if (article.dataset.highlight === 'false') return;

  var dialog = document.getElementById('shareCardDialog');
  var dialogImage = document.getElementById('shareCardImage');
  var dialogLoading = dialog ? dialog.querySelector('[data-share-card-loading]') : null;
  var downloadButton = dialog ? dialog.querySelector('[data-share-card-download]') : null;
  var nativeButton = dialog ? dialog.querySelector('[data-share-card-native]') : null;
  var dialogStatus = document.getElementById('shareCardStatus');
  var statusRegion = document.getElementById('articleActionStatus');
  var markButton = toolbar.querySelector('[data-hl-action="mark"]');
  var unmarkButton = toolbar.querySelector('[data-hl-action="unmark"]');
  var shareButton = toolbar.querySelector('[data-hl-action="share"]');

  var storageKey = KEY_PREFIX + location.pathname.replace(/\/+$/, '');
  var marks = loadMarks();
  var state = null;
  var pinnedAt = 0;
  var selectionTimer = null;
  var pendingShare = null;
  var pendingQuote = '';

  function loadMarks() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (item) {
        return item && typeof item.start === 'number' && typeof item.end === 'number' && item.end > item.start;
      });
    } catch (error) {
      return [];
    }
  }

  function saveMarks() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(marks.slice(-MAX_MARKS)));
    } catch (error) {
      /* 隐私模式下写入会被拒，划线只在本次会话有效，不弹窗打断阅读 */
    }
  }

  /* 必须收全部文本节点（包括 <style>/<script> 与块之间的换行）——
     Range.toString() 和 textContent 都把它们算进偏移，少收一个就会整体错位。
     编辑器会把内容自带的样式以 <style class="pjax"> 塞进正文开头，正是这个坑。 */
  function textNodes() {
    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node = walker.nextNode();
    while (node) {
      if (node.nodeValue && node.nodeValue.length) nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  /* 用 Range 量前缀长度，比手工累加更稳，也自动忽略注释节点 */
  function offsetAt(container, offset) {
    var range = document.createRange();
    try {
      range.setStart(content, 0);
      range.setEnd(container, offset);
    } catch (error) {
      return -1;
    }
    return range.toString().length;
  }

  function paintMark(id, start, end) {
    var nodes = textNodes();
    var cursor = 0;
    var pieces = [];
    nodes.forEach(function (node) {
      var length = node.nodeValue.length;
      var nodeStart = cursor;
      var nodeEnd = cursor + length;
      cursor = nodeEnd;
      if (nodeEnd <= start || nodeStart >= end) return;
      pieces.push({
        node: node,
        from: Math.max(0, start - nodeStart),
        to: Math.min(length, end - nodeStart)
      });
    });
    pieces.forEach(function (piece) {
      if (piece.to <= piece.from || !piece.node.parentNode) return;
      var range = document.createRange();
      range.setStart(piece.node, piece.from);
      range.setEnd(piece.node, piece.to);
      var span = document.createElement('span');
      span.className = 'hl-mark';
      span.setAttribute('data-hl-id', id);
      try {
        range.surroundContents(span);
      } catch (error) {
        /* 一个文本节点被其它标签截断时跳过这一段，剩下的段照常包 */
      }
    });
  }

  function clearMarks() {
    var painted = content.querySelectorAll('.hl-mark');
    for (var i = 0; i < painted.length; i++) {
      painted[i].replaceWith(document.createTextNode(painted[i].textContent));
    }
    content.normalize();
  }

  function paintAll() {
    clearMarks();
    marks.forEach(function (mark) {
      paintMark(mark.id, mark.start, mark.end);
    });
  }

  function announce(message) {
    if (!statusRegion || !message) return;
    statusRegion.textContent = message;
    window.setTimeout(function () {
      if (statusRegion.textContent === message) statusRegion.textContent = '';
    }, 2200);
  }

  function hideToolbar() {
    toolbar.removeAttribute('data-open');
    state = null;
    pinnedAt = 0;
  }

  function showToolbar(rect, next) {
    state = next;
    toolbar.setAttribute('data-open', 'true');
    var barWidth = toolbar.offsetWidth;
    var barHeight = toolbar.offsetHeight;
    var center = rect.left + rect.width / 2;
    var left = clamp(center - barWidth / 2, 10, Math.max(10, window.innerWidth - barWidth - 10));
    var top = rect.top - barHeight - 12;
    var below = false;
    if (top < 8) {
      top = rect.bottom + 12;
      below = true;
    }
    toolbar.style.left = Math.round(left) + 'px';
    toolbar.style.top = Math.round(clamp(top, 8, window.innerHeight - barHeight - 8)) + 'px';
    toolbar.setAttribute('data-below', below ? 'true' : 'false');
    toolbar.style.setProperty('--hl-arrow-x', Math.round(clamp(center - left, 16, barWidth - 16)) + 'px');
    markButton.hidden = !!next.markId;
    unmarkButton.hidden = !next.markId;
  }

  function markAt(start, end) {
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].start <= start && marks[i].end >= end) return marks[i];
      if (marks[i].start < end && marks[i].end > start) return marks[i];
    }
    return null;
  }

  function handleSelection() {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (pinnedAt && Date.now() - pinnedAt < 900) return;
      hideToolbar();
      return;
    }
    var range = selection.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) {
      hideToolbar();
      return;
    }
    var start = offsetAt(range.startContainer, range.startOffset);
    var end = offsetAt(range.endContainer, range.endOffset);
    if (start < 0 || end <= start) {
      hideToolbar();
      return;
    }
    var picked = range.toString();
    var leading = picked.length - picked.replace(/^\s+/, '').length;
    var trailing = picked.length - picked.replace(/\s+$/, '').length;
    start += leading;
    end -= trailing;
    if (end <= start) {
      hideToolbar();
      return;
    }
    var text = content.textContent.slice(start, end);
    var existing = markAt(start, end);
    var rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;
    pinnedAt = 0;
    showToolbar(rect, {
      start: start,
      end: end,
      text: text,
      markId: existing ? existing.id : null,
      range: range.cloneRange(),
      anchorEl: null
    });
  }

  function addMark() {
    if (!state) return;
    if (state.markId) {
      hideToolbar();
      return;
    }
    var start = state.start;
    var end = state.end;
    marks = marks.filter(function (mark) {
      return mark.end <= start || mark.start >= end;
    });
    marks.push({
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      start: start,
      end: end,
      text: content.textContent.slice(start, end)
    });
    marks.sort(function (a, b) { return a.start - b.start; });
    saveMarks();
    paintAll();
    hideToolbar();
    var selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    announce(toolbar.dataset.tipSaved);
  }

  function removeMark(id) {
    if (!id) return;
    marks = marks.filter(function (mark) { return mark.id !== id; });
    saveMarks();
    paintAll();
    hideToolbar();
    announce(toolbar.dataset.tipRemoved);
  }

  /* 工具条自身按下时不要抢走选区。
     只在 mousedown 上 preventDefault：touchstart 上拦截会把后续 click 一起吃掉，
     手机端点按钮就没反应了。触摸端靠 pinnedAt 的宽限时间撑住工具条。 */
  toolbar.addEventListener('mousedown', function (event) { event.preventDefault(); });
  toolbar.addEventListener('pointerdown', function () { pinnedAt = Date.now(); });

  toolbar.addEventListener('click', function (event) {
    var button = event.target.closest('[data-hl-action]');
    if (!button) return;
    var action = button.dataset.hlAction;
    if (action === 'mark') addMark();
    else if (action === 'unmark') removeMark(state && state.markId);
    else if (action === 'share') {
      var text = state && state.text;
      hideToolbar();
      openShareCard(text);
    }
  });

  /* 点已经划过的文字：直接给这一段的分享入口 */
  content.addEventListener('mousedown', function (event) {
    var mark = event.target.closest('.hl-mark');
    if (!mark) return;
    event.preventDefault();
    var id = mark.getAttribute('data-hl-id');
    var record = null;
    marks.forEach(function (item) { if (item.id === id) record = item; });
    if (!record) return;
    var rect = mark.getBoundingClientRect();
    pinnedAt = Date.now();
    showToolbar(rect, {
      start: record.start,
      end: record.end,
      text: record.text || content.textContent.slice(record.start, record.end),
      markId: record.id,
      range: null,
      anchorEl: mark
    });
  });

  document.addEventListener('selectionchange', function () {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(handleSelection, 150);
  });

  document.addEventListener('mousedown', function (event) {
    if (toolbar.contains(event.target) || event.target.closest('.hl-mark')) return;
    hideToolbar();
  });

  /* 滚动时跟着选区走，而不是直接消失：手机上滚动几乎必然发生，
     一滚就收会让工具条看起来「没出来过」。 */
  var followFrame = 0;
  function followAnchor() {
    followFrame = 0;
    if (!state) return;
    var rect = null;
    try {
      if (state.anchorEl && state.anchorEl.isConnected) rect = state.anchorEl.getBoundingClientRect();
      else if (state.range) rect = state.range.getBoundingClientRect();
    } catch (error) {
      rect = null;
    }
    if (!rect || (!rect.width && !rect.height)) {
      hideToolbar();
      return;
    }
    showToolbar(rect, state);
  }
  window.addEventListener('scroll', function () {
    if (!state || followFrame) return;
    followFrame = window.requestAnimationFrame(followAnchor);
  }, { passive: true });
  window.addEventListener('resize', hideToolbar, { passive: true });

  /* ---------- 分享图 ---------- */

  function announceShare(message) {
    if (!dialogStatus || !message) return;
    dialogStatus.textContent = message;
    window.setTimeout(function () {
      if (dialogStatus.textContent === message) dialogStatus.textContent = '';
    }, 2200);
  }

  function supportsFileShare(blob) {
    if (!blob || !navigator.canShare || !navigator.share) return false;
    try {
      return navigator.canShare({ files: [new File([blob], 'share.png', { type: 'image/png' })] });
    } catch (error) {
      return false;
    }
  }

  function openShareCard(text) {
    if (!dialog) {
      announce(toolbar.dataset.tipSelect);
      return;
    }
    var data = article.dataset;
    pendingShare = null;
    pendingQuote = text || '';
    if (dialogImage) {
      dialogImage.hidden = true;
      dialogImage.removeAttribute('src');
    }
    if (dialogLoading) dialogLoading.hidden = false;
    if (nativeButton) nativeButton.hidden = true;
    if (downloadButton) downloadButton.disabled = true;
    dialog.setAttribute('data-ready', 'false');
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    createShareCard({
      quote: text || '',
      title: data.articleTitle || '',
      category: data.articleCategory || '',
      date: data.articleDate || '',
      author: data.articleAuthor || '',
      authorPrefix: data.authorPrefix || '',
      url: data.articleUrl || location.href,
      brand: dialog.dataset.brand || '',
      brandShort: dialog.dataset.brandShort || '',
      qrHint: dialog.dataset.tipQr || '',
      qrScript: dialog.dataset.qrScript || ''
    }).then(function (card) {
      pendingShare = card;
      if (dialogImage) {
        dialogImage.src = card.dataUrl;
        dialogImage.hidden = false;
      }
      if (dialogLoading) dialogLoading.hidden = true;
      if (downloadButton) downloadButton.disabled = false;
      if (nativeButton) nativeButton.hidden = !supportsFileShare(card.blob);
      dialog.setAttribute('data-ready', 'true');
    }).catch(function () {
      if (dialogLoading) {
        dialogLoading.hidden = false;
        dialogLoading.textContent = dialog.dataset.tipFailed || '';
      }
    });
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  if (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('cancel', function () { closeDialog(); });
    var closeButton = dialog.querySelector('[data-share-card-close]');
    if (closeButton) closeButton.addEventListener('click', closeDialog);

    if (downloadButton) {
      downloadButton.addEventListener('click', function () {
        if (!pendingShare) return;
        var link = document.createElement('a');
        link.href = pendingShare.dataUrl;
        link.download = (article.dataset.articleTitle || document.title || 'nucma') + '.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        announceShare(dialog.dataset.tipSaved);
      });
    }

    if (nativeButton) {
      nativeButton.addEventListener('click', function () {
        if (!pendingShare || !pendingShare.blob) return;
        var file = new File([pendingShare.blob], (article.dataset.articleTitle || 'nucma') + '.png', { type: 'image/png' });
        navigator.share({
          files: [file],
          title: article.dataset.articleTitle || document.title,
          text: pendingQuote
        }).catch(function () {
          announceShare(dialog.dataset.tipFailed);
        });
      });
    }
  }

  paintAll();
}
