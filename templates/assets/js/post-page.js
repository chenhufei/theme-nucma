(function() {
  function cleanLeakedCommentWidgetText() {
    const commentShells = document.querySelectorAll('.post-comments-shell, .photo-comments-shell');
    commentShells.forEach((shell) => {
      const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT);
      const leakedNodes = [];

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = (node.nodeValue || '').trim();
        if (
          value.includes('PluginCommentWidget')
          && value.includes('comment-widget.js')
          && value.includes('init(')
        ) {
          leakedNodes.push(node);
        }
      }

      leakedNodes.forEach((node) => node.remove());
    });
  }

  cleanLeakedCommentWidgetText();

  const commentObserver = new MutationObserver(cleanLeakedCommentWidgetText);
  document.querySelectorAll('.post-comments-shell, .photo-comments-shell').forEach((shell) => {
    commentObserver.observe(shell, { childList: true, subtree: true, characterData: true });
  });

  const prose = document.querySelector('.prose');
  if (!prose) return;

  const advancedConfig = (window.themeConfig && window.themeConfig.advanced) || {};
  const isEnabled = (value) => !(value === false || String(value).toLowerCase() === 'false');
  const showToast = (message, type = 'info') => {
    if (typeof window.showThemeToast === 'function') {
      window.showThemeToast(message, type);
    }
  };

  if (document.body) {
    document.body.dataset.postCodeCopyManaged = 'true';
    document.body.dataset.postLightboxManaged = 'true';
  }

  prose.querySelectorAll('table').forEach(table => {
    if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  const text = prose.textContent || '';
  const words = text.trim().length;
  const minutes = Math.max(1, Math.ceil(words / 300));
  const readingTimeTarget = document.getElementById('readingTimeText');
  if (readingTimeTarget) {
    readingTimeTarget.textContent = `${minutes} \u5206\u949f\u9605\u8bfb`;
  }

  const copyLinkButton = document.querySelector('[data-copy-link]');
  if (copyLinkButton) {
    const defaultLabel = copyLinkButton.textContent;
    copyLinkButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        copyLinkButton.textContent = '\u94fe\u63a5\u5df2\u590d\u5236';
        showToast('\u6587\u7ae0\u94fe\u63a5\u5df2\u590d\u5236', 'success');
      } catch (error) {
        copyLinkButton.textContent = '\u590d\u5236\u5931\u8d25';
        showToast('\u94fe\u63a5\u590d\u5236\u5931\u8d25', 'error');
      } finally {
        window.setTimeout(() => {
          copyLinkButton.textContent = defaultLabel;
        }, 1500);
      }
    });
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  if (isEnabled(advancedConfig.enable_image_lightbox) && lightbox && lightboxImg) {
    const closeLightbox = () => {
      lightbox.style.display = 'none';
      lightboxImg.src = '';
      lightboxImg.alt = '';
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    lightbox.setAttribute('aria-hidden', 'true');

    prose.querySelectorAll('img').forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt || '';
        lightbox.style.display = 'flex';
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      });
    });

    lightbox.addEventListener('click', event => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && lightbox.style.display === 'flex') {
        closeLightbox();
      }
    });
  }

  if (isEnabled(advancedConfig.enable_code_copy)) {
    prose.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.post-copy-btn, .theme-copy-btn')) return;
      pre.style.position = 'relative';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'post-copy-btn';
      button.textContent = '\u590d\u5236';
      const defaultLabel = button.textContent;

      button.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const value = code ? (code.innerText || code.textContent || '') : (pre.innerText || pre.textContent || '');

        try {
          await navigator.clipboard.writeText(value);
          button.textContent = '\u5df2\u590d\u5236';
          showToast('\u4ee3\u7801\u5df2\u590d\u5236', 'success');
        } catch (error) {
          button.textContent = '\u5931\u8d25';
          showToast('\u590d\u5236\u5931\u8d25', 'error');
        } finally {
          window.setTimeout(() => {
            button.textContent = defaultLabel;
          }, 1500);
        }
      });

      pre.appendChild(button);
    });
  }
})();
