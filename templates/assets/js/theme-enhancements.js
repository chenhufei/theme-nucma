(function () {
  class ThemeToastManager {
    init() {
      if (typeof window.showThemeToast !== 'function') {
        window.showThemeToast = (message, type = 'info', options = {}) => this.show(message, type, options);
      }

      window.addEventListener('theme:toast', (event) => {
        const detail = event.detail || {};
        if (detail.message) {
          this.show(detail.message, detail.type || 'info', detail);
        }
      });
    }

    ensureHost() {
      let host = document.getElementById('themeToastHost');

      if (!host) {
        host = document.createElement('div');
        host.id = 'themeToastHost';
        host.className = 'theme-toast-host';
        document.body.appendChild(host);
      }

      return host;
    }

    getIcon(type) {
      switch (type) {
        case 'success':
          return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        case 'error':
          return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        case 'warning':
          return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.66 18h16.68a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z"/></svg>';
        default:
          return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"/></svg>';
      }
    }

    show(message, type = 'info', options = {}) {
      if (!message || !document.body) return null;

      const host = this.ensureHost();
      const toast = document.createElement('div');
      const duration = Number(options.duration) > 0 ? Number(options.duration) : 2200;

      toast.className = `theme-toast is-${type}`;
      toast.innerHTML = `
        <span class="theme-toast-icon">${this.getIcon(type)}</span>
        <div class="theme-toast-message"></div>
      `;
      toast.querySelector('.theme-toast-message').textContent = String(message);

      host.appendChild(toast);

      const closeToast = () => {
        if (!toast.isConnected || toast.dataset.leaving === 'true') return;
        toast.dataset.leaving = 'true';
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 200);
      };

      window.setTimeout(closeToast, duration);

      return toast;
    }
  }

  class ThemeReadingProgress {
    constructor() {
      this.progressRoot = null;
      this.progressBar = null;
      this.ticking = false;
      this.maxScroll = 0;
      this.shouldShow = false;
      this.resizeObserver = null;
      this.boundUpdate = this.scheduleUpdate.bind(this);
      this.boundMeasure = this.measure.bind(this);
    }

    init() {
      if (document.getElementById('themeReadingProgress') || !document.body) return;

      this.progressRoot = document.createElement('div');
      this.progressRoot.id = 'themeReadingProgress';
      this.progressRoot.className = 'theme-reading-progress';
      this.progressRoot.innerHTML = '<div class="theme-reading-progress-bar"></div>';
      document.body.appendChild(this.progressRoot);

      this.progressBar = this.progressRoot.firstElementChild;

      window.addEventListener('scroll', this.boundUpdate, { passive: true });
      window.addEventListener('resize', this.boundMeasure);
      window.addEventListener('load', this.boundMeasure);
      window.addEventListener('themeChanged', this.boundMeasure);
      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(this.boundMeasure);
        this.resizeObserver.observe(document.body);
      }

      this.measure();
    }

    measure() {
      this.maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      this.shouldShow = this.maxScroll > Math.max(320, window.innerHeight * 0.35);
      this.scheduleUpdate();
    }

    scheduleUpdate() {
      if (this.ticking) return;

      this.ticking = true;
      window.requestAnimationFrame(() => {
        this.ticking = false;
        this.update();
      });
    }

    update() {
      if (!this.progressRoot || !this.progressBar) return;

      const progress = this.maxScroll > 0 ? Math.min(window.scrollY / this.maxScroll, 1) : 0;

      this.progressRoot.classList.toggle('is-visible', this.shouldShow);
      this.progressBar.style.transform = `scaleX(${progress})`;
    }
  }

  class ThemeContentEnhancer {
    constructor(config, toastManager) {
      this.config = config || {};
      this.toastManager = toastManager || null;
    }

    init() {
      this.initFaq();
      this.initImageLightbox();
      this.initCodeCopy();
      this.initExternalLinks();
    }

    isEnabled(value) {
      return !(value === false || String(value).toLowerCase() === 'false');
    }

    showToast(message, type = 'info') {
      if (this.toastManager && typeof this.toastManager.show === 'function') {
        this.toastManager.show(message, type);
        return;
      }

      if (typeof window.showThemeToast === 'function') {
        window.showThemeToast(message, type);
      }
    }

    initFaq() {
      const faqList = document.getElementById('faqList');
      if (!faqList) return;

      faqList.addEventListener('click', (event) => {
        const button = event.target.closest('.faq-btn');
        if (!button || typeof window.toggleFaq !== 'function') return;
        window.toggleFaq(button);
      });
    }

    initImageLightbox() {
      if (!this.isEnabled(this.config.advanced?.enable_image_lightbox)) return;
      if ((document.body && document.body.dataset.postLightboxManaged === 'true') || document.getElementById('lightbox')) return;

      document.querySelectorAll('img').forEach((image) => {
        if (image.dataset.themeLightboxBound === 'true') return;
        image.dataset.themeLightboxBound = 'true';

        image.addEventListener('click', (event) => {
          if (event.target.closest('.prose') || event.target.closest('.post-content')) {
            this.openImageLightbox(image.currentSrc || image.src, image.alt || '');
          }
        });
      });
    }

    openImageLightbox(src, alt = '') {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4';
      overlay.dataset.themeLightbox = 'true';
      overlay.innerHTML = `
        <img src="${src}" alt="${String(alt).replace(/"/g, '&quot;')}" class="max-w-[90vw] max-h-[90vh] object-contain">
        <button type="button" class="absolute top-4 right-4 text-white p-2" aria-label="Close lightbox">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      `;

      const handleKeydown = (event) => {
        if (event.key === 'Escape') {
          cleanup();
        }
      };

      const cleanup = () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeydown);
        overlay.remove();
      };

      overlay.querySelector('button').addEventListener('click', cleanup);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          cleanup();
        }
      });

      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeydown);
    }

    initCodeCopy() {
      if (document.body?.dataset.postCodeCopyManaged === 'true') return;

      if (!this.isEnabled(this.config.advanced?.enable_code_copy)) {
        document.querySelectorAll('.theme-copy-btn, .post-copy-btn, .code-copy-btn').forEach((button) => button.remove());
        return;
      }

      document.querySelectorAll('pre code').forEach((code) => {
        const pre = code.closest('pre');
        if (!pre || pre.querySelector('.theme-copy-btn, .post-copy-btn, .code-copy-btn')) return;

        const button = document.createElement('button');
        const defaultIcon = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
        const successIcon = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';

        button.type = 'button';
        button.className = 'theme-copy-btn absolute top-2 right-2 p-1.5 rounded-md';
        button.innerHTML = defaultIcon;
        button.title = '\u590d\u5236\u4ee3\u7801';

        pre.style.position = 'relative';
        pre.appendChild(button);

        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code.textContent || '');
            button.innerHTML = successIcon;
            button.title = '\u5df2\u590d\u5236';
            button.style.transform = 'scale(1.15)';
            button.style.color = 'rgb(var(--color-success))';
            button.style.borderColor = 'rgba(var(--color-success), 0.3)';
            this.showToast('\u4ee3\u7801\u5df2\u590d\u5236', 'success');

            window.setTimeout(() => {
              button.innerHTML = defaultIcon;
              button.title = '\u590d\u5236\u4ee3\u7801';
              button.style.transform = '';
              button.style.color = '';
              button.style.borderColor = '';
            }, 2000);
          } catch (error) {
            console.error('copy failed:', error);
            this.showToast('\u590d\u5236\u5931\u8d25', 'error');
          }
        });
      });
    }

    initExternalLinks() {
      if (!this.isEnabled(this.config.advanced?.enable_external_link_icon)) return;

      document.querySelectorAll('a[href^="http"]').forEach((link) => {
        try {
          if (link.hostname && link.hostname !== window.location.hostname) {
            link.classList.add('external-link');
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          }
        } catch (error) {
          console.error('external link handling failed:', error);
        }
      });
    }
  }

  window.ThemeEnhancements = Object.assign({}, window.ThemeEnhancements || {}, {
    ThemeToastManager,
    ThemeReadingProgress,
    ThemeContentEnhancer
  });
})();
