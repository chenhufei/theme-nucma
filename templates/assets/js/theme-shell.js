(function () {
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function resolveThemeMode(mode) {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return mode === 'dark' ? 'dark' : 'light';
  }

  function applyThemeMode(mode, options = {}) {
    if (typeof window.applyThemeMode === 'function') {
      window.applyThemeMode(mode, options);
      return;
    }

    const actualMode = resolveThemeMode(mode);
    document.documentElement.setAttribute('data-theme', actualMode);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(actualMode);
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme', actualMode);

    if (options.emitEvent !== false) {
      window.dispatchEvent(new CustomEvent('themeChanged', {
        detail: {
          mode,
          actualMode
        }
      }));
    }
  }

  class ThemeShell {
    constructor(config) {
      this.config = config || {};
      this.heroVisible = true;
    }

    init() {
      this.applyRuntimePreferences();
      this.applyHomeSectionOrder();
      this.initThemeToggle();
      this.initScrollState();
      this.initNavIndicator();
      this.initMobileMenu();
      this.initHeaderSearch();
      this.initActionButtons();
      this.initImageFallbacks();
      this.initHeroScrollHint();
      this.initLazyImages();
      this.initBackToTop();
      this.initSitePopup();
      this.initPageTools();
      this.initAccessibility();
    }

    applyRuntimePreferences() {
      const root = document.documentElement;
      const appearanceConfig = this.config.appearance || {};
      const performanceConfig = this.config.performance || {};
      const reduceLargeAnimations = performanceConfig.disable_large_animations === true
        || String(performanceConfig.disable_large_animations).toLowerCase() === 'true'
        || prefersReducedMotion();

      root.classList.toggle('theme-performance-lite', reduceLargeAnimations);
      root.classList.toggle('theme-reduced-motion', prefersReducedMotion());
      this.applyBackgroundPreferences(root, appearanceConfig);
    }

    applyBackgroundPreferences(root, appearanceConfig) {
      const allowedBackgroundModes = ['mesh', 'aurora', 'campus-grid', 'paper', 'prism', 'night', 'plain', 'image', 'none'];
      const allowedGlassStrengths = ['soft', 'standard', 'strong'];
      const allowedGlassRefractions = ['adaptive', 'on', 'off'];
      const allowedGlassDensities = ['airy', 'balanced', 'solid'];
      const resolveAttachmentUrl = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value.trim();
        if (Array.isArray(value)) return resolveAttachmentUrl(value[0]);
        if (typeof value === 'object') {
          return String(
            value.permalink
            || value.url
            || value.href
            || value.status?.permalink
            || value.spec?.url
            || ''
          ).trim();
        }
        return String(value).trim();
      };
      const backgroundMode = allowedBackgroundModes.includes(appearanceConfig.background_mode)
        ? appearanceConfig.background_mode
        : 'mesh';
      const glassStrength = allowedGlassStrengths.includes(appearanceConfig.glass_strength)
        ? appearanceConfig.glass_strength
        : 'standard';
      const glassRefraction = allowedGlassRefractions.includes(appearanceConfig.glass_refraction)
        ? appearanceConfig.glass_refraction
        : 'adaptive';
      const glassDensity = allowedGlassDensities.includes(appearanceConfig.glass_density)
        ? appearanceConfig.glass_density
        : 'balanced';
      const backgroundImage = resolveAttachmentUrl(appearanceConfig.background_image);
      const clampNumber = (value, fallback, min, max) => {
        const number = Number.parseFloat(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
      };
      const imageOpacity = clampNumber(appearanceConfig.background_image_opacity, 0.28, 0, 1);
      const patternOpacity = clampNumber(appearanceConfig.background_pattern_opacity, 0.52, 0, 1);
      const imageOverlayOpacity = Math.min(0.76, Math.max(0.2, 0.78 - imageOpacity));
      const imageOverlayDarkOpacity = Math.min(0.82, Math.max(0.28, 0.88 - imageOpacity));
      const imageOverlaySoftOpacity = Math.min(0.7, Math.max(0.14, imageOverlayOpacity * 0.72));
      const imageOverlayDarkSoftOpacity = Math.min(0.78, Math.max(0.22, imageOverlayDarkOpacity * 0.78));

      allowedBackgroundModes.forEach((mode) => root.classList.remove(`theme-bg-${mode}`));
      allowedGlassStrengths.forEach((strength) => root.classList.remove(`theme-glass-${strength}`));
      allowedGlassRefractions.forEach((mode) => root.classList.remove(`theme-glass-refraction-${mode}`));
      allowedGlassDensities.forEach((density) => root.classList.remove(`theme-glass-density-${density}`));
      root.classList.toggle('theme-bg-has-image', Boolean(backgroundImage));
      root.classList.add(`theme-bg-${backgroundMode}`);
      root.classList.add(`theme-glass-${glassStrength}`);
      root.classList.add(`theme-glass-refraction-${glassRefraction}`);
      root.classList.add(`theme-glass-density-${glassDensity}`);
      root.style.setProperty('--theme-custom-bg-position', appearanceConfig.background_position || 'center center');
      root.style.setProperty('--theme-bg-image-opacity', imageOpacity.toFixed(3));
      root.style.setProperty('--theme-bg-pattern-opacity', patternOpacity.toFixed(3));
      root.style.setProperty('--theme-bg-image-overlay-opacity', imageOverlayOpacity.toFixed(3));
      root.style.setProperty('--theme-bg-image-dark-overlay-opacity', imageOverlayDarkOpacity.toFixed(3));
      root.style.setProperty('--theme-bg-image-overlay-soft-opacity', imageOverlaySoftOpacity.toFixed(3));
      root.style.setProperty('--theme-bg-image-dark-overlay-soft-opacity', imageOverlayDarkSoftOpacity.toFixed(3));
      root.style.setProperty('--theme-custom-bg-image', backgroundImage
        ? `url("${backgroundImage.replace(/"/g, '\\"')}")`
        : 'none');
    }

    applyHomeSectionOrder() {
      const main = document.querySelector('.theme-page-home main');
      if (!main) return;

      const homeConfig = this.config.home || {};
      const defaultOrder = 'hero,about-alliance,service-directions,site-portal,posts,links,members,reviews,faq';
      const orderItems = Array.isArray(homeConfig.section_order_items)
        ? homeConfig.section_order_items
        : [];
      const itemMap = new Map(orderItems
        .map((item) => [String(item?.section_key || item?.key || item?.value || '').trim(), item])
        .filter(([key]) => Boolean(key)));
      const sections = orderItems.length
        ? orderItems
          .filter((item) => item && item.enabled !== false && String(item.enabled).toLowerCase() !== 'false')
          .map((item) => String(item.section_key || item.key || item.value || '').trim())
          .filter(Boolean)
        : String(homeConfig.section_order || defaultOrder)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
      const disabledSections = new Set(orderItems
        .filter((item) => item && (item.enabled === false || String(item.enabled).toLowerCase() === 'false'))
        .map((item) => String(item.section_key || item.key || item.value || '').trim())
        .filter(Boolean));
      const orderMap = new Map(sections.map((name, index) => [name, index + 1]));
      let fallbackIndex = sections.length + 1;

      main.querySelectorAll('[data-section]').forEach((section) => {
        const name = section.getAttribute('data-section');
        section.hidden = disabledSections.has(name);
        if (disabledSections.has(name)) return;
        const index = orderMap.has(name) ? orderMap.get(name) : fallbackIndex++;
        section.style.setProperty('--home-section-order', String(index * 10));
      });

      main.querySelectorAll('[data-home-text]').forEach((element) => {
        const [sectionKey, fieldName] = String(element.dataset.homeText || '').split(':');
        const value = itemMap.get(sectionKey)?.[fieldName];
        if (value == null) return;
        const text = String(value).trim();
        if (!text) return;
        element.textContent = text;
      });
    }

    initScrollState() {
      const root = document.documentElement;
      let scrolling = false;
      let timer = 0;
      let headerTicking = false;

      const applyHeaderState = () => {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const atTop = scrollY <= 8;

        root.classList.toggle('site-header-at-top', atTop);
        root.classList.toggle('site-header-scrolled', !atTop);
        headerTicking = false;
      };

      const requestHeaderState = () => {
        if (headerTicking) return;
        headerTicking = true;
        window.requestAnimationFrame(applyHeaderState);
      };

      window.addEventListener('scroll', () => {
        if (!scrolling) {
          scrolling = true;
          root.classList.add('is-scrolling');
        }

        requestHeaderState();
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          scrolling = false;
          root.classList.remove('is-scrolling');
        }, 140);
      }, { passive: true });

      applyHeaderState();
    }

    initThemeToggle() {
      const button = document.getElementById('themeToggle');
      if (!button) return;

      button.addEventListener('click', () => {
        const currentMode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const nextMode = currentMode === 'dark' ? 'light' : 'dark';

        if (!document.startViewTransition || prefersReducedMotion()) {
          applyThemeMode(nextMode);
          return;
        }

        const rect = button.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
          applyThemeMode(nextMode);
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
            },
            {
              duration: 520,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        });
      });
    }

    initNavIndicator() {
      const nav = document.getElementById('desktopNav');
      if (!nav) return;

      const indicator = document.createElement('div');
      indicator.className = 'nav-indicator';
      indicator.style.cssText = [
        'position:absolute',
        'height:24px',
        'background:rgba(var(--color-accent),0.08)',
        'border:1px solid rgba(var(--color-accent),0.12)',
        'border-radius:8px',
        'transition:left 0.18s ease,width 0.18s ease,top 0.18s ease,opacity 0.18s ease',
        'pointer-events:none',
        'z-index:-1',
        'opacity:0'
      ].join(';');

      nav.style.position = 'relative';
      nav.appendChild(indicator);

      const links = nav.querySelectorAll('a, button');
      if (links.length === 0) return;

      const resolveActiveLink = () => {
        const currentPath = window.location.pathname;
        let activeLink = null;

        links.forEach((link) => {
          const href = link.getAttribute('href');
          if (href && (href === currentPath || currentPath.startsWith(href + '/') || (href !== '/' && currentPath.startsWith(href)))) {
            activeLink = link;
          }
        });

        return activeLink;
      };

      const updateIndicator = (element) => {
        if (!element) {
          indicator.style.opacity = '0';
          return;
        }

        const rect = element.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        indicator.style.left = (rect.left - navRect.left + 4) + 'px';
        indicator.style.width = (rect.width - 8) + 'px';
        indicator.style.top = ((rect.top - navRect.top) + (rect.height - 24) / 2) + 'px';
        indicator.style.opacity = '1';
      };

      updateIndicator(resolveActiveLink());

      links.forEach((link) => {
        link.addEventListener('mouseenter', () => updateIndicator(link));
        link.addEventListener('focus', () => updateIndicator(link));
      });

      nav.addEventListener('mouseleave', () => updateIndicator(resolveActiveLink()));
      nav.addEventListener('focusout', () => {
        window.requestAnimationFrame(() => {
          if (!nav.contains(document.activeElement)) {
            updateIndicator(resolveActiveLink());
          }
        });
      });
    }

    initMobileMenu() {
      const overlay = document.getElementById('mobileOverlay');
      const sidebar = document.getElementById('mobileSidebar');
      if (!overlay || !sidebar) return;

      window.openMobileMenu = () => {
        overlay.style.display = 'block';
        sidebar.style.display = 'block';
        document.body.classList.add('menu-open');
        document.body.style.overflow = 'hidden';

        window.requestAnimationFrame(() => {
          overlay.style.opacity = '1';
          sidebar.style.transform = 'translateX(0)';
        });
      };

      window.closeMobileMenu = () => {
        overlay.style.opacity = '0';
        sidebar.style.transform = 'translateX(-100%)';
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';

        window.setTimeout(() => {
          overlay.style.display = 'none';
          sidebar.style.display = 'none';
        }, 300);
      };
    }

    openSearchWidget() {
      if (window.SearchWidget && typeof window.SearchWidget.open === 'function') {
        window.SearchWidget.open();
        return;
      }

      window.location.assign('/search');
    }

    initHeaderSearch() {
      document.querySelectorAll('[data-header-search]').forEach((form) => {
        if (form.dataset.searchReady === 'true') return;
        form.dataset.searchReady = 'true';

        const input = form.querySelector('input[type="search"]');
        const mode = form.dataset.searchMode === 'click' ? 'click' : 'hover';

        const open = () => {
          form.classList.add('is-active');
          if (input) window.requestAnimationFrame(() => input.focus());
        };

        const close = () => {
          if (mode !== 'click') return;
          if (input && input.value.trim()) return;
          form.classList.remove('is-active');
        };

        form.addEventListener('submit', (event) => {
          const keyword = input ? input.value.trim() : '';
          if (mode === 'click' && !form.classList.contains('is-active')) {
            event.preventDefault();
            open();
            return;
          }

          if (!keyword) {
            event.preventDefault();
            this.openSearchWidget();
          }
        });

        form.addEventListener('click', (event) => {
          if (mode !== 'click') return;
          if (!form.classList.contains('is-active')) {
            event.preventDefault();
            open();
          }
        });

        form.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            if (input) input.value = '';
            form.classList.remove('is-active');
          }
        });

        document.addEventListener('click', (event) => {
          if (mode !== 'click') return;
          if (!form.contains(event.target)) close();
        });
      });
    }

    initActionButtons() {
      document.addEventListener('click', (event) => {
        const closeTarget = event.target.closest('[data-mobile-menu-close]');
        if (closeTarget && typeof window.closeMobileMenu === 'function') {
          window.closeMobileMenu();
          return;
        }

        const actionTarget = event.target.closest('[data-theme-action]');
        if (!actionTarget) return;

        const action = actionTarget.dataset.themeAction;
        if (action === 'search') {
          this.openSearchWidget();
          return;
        }

        if (action === 'toggle-theme') {
          const themeButton = document.getElementById('themeToggle');
          if (themeButton) themeButton.click();
          return;
        }

        if (action === 'open-menu' && typeof window.openMobileMenu === 'function') {
          window.openMobileMenu();
        }
      });
    }

    initImageFallbacks() {
      document.addEventListener('error', (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) return;

        const fallback = image.nextElementSibling;
        const logoFallback = image.parentElement?.querySelector('[data-logo-fallback]');
        const targetFallback = fallback?.classList?.contains('theme-placeholder-icon')
          ? fallback
          : logoFallback;

        if (!targetFallback) return;

        image.hidden = true;
        targetFallback.style.display = 'block';
      }, true);
    }

    initHeroScrollHint() {
      const hint = document.getElementById('heroScrollHint');
      if (!hint) return;

      let shown = false;
      window.setTimeout(() => {
        if (window.scrollY < 10) {
          hint.style.opacity = '1';
          hint.style.transform = 'translateX(-50%) translateY(0) scale(1)';
          shown = true;
        }
      }, 1500);

      const onScroll = () => {
        const scrollY = window.scrollY;
        if (scrollY > 100) {
          hint.style.opacity = '0';
          hint.style.transform = 'translateX(-50%) translateY(24px) scale(0.8)';
          shown = false;
        } else if (!shown && scrollY < 10) {
          hint.style.opacity = '1';
          hint.style.transform = 'translateX(-50%) translateY(0) scale(1)';
          shown = true;
        }
      };

      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          onScroll();
        });
      }, { passive: true });
      hint.style.pointerEvents = 'auto';
      hint.style.cursor = 'pointer';
      hint.addEventListener('click', () => {
        const heroSection = document.getElementById('hero');
        const target = heroSection ? heroSection.offsetHeight - 56 : window.innerHeight;
        window.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    }

    initLazyImages() {
      const lazyDisabled = this.config.performance?.disable_image_lazy === true
        || String(this.config.performance?.disable_image_lazy).toLowerCase() === 'true';
      if (lazyDisabled) return;
      if ('loading' in HTMLImageElement.prototype) return;
      if (prefersReducedMotion()) return;

      const lazyImages = document.querySelectorAll('img[data-src]');
      if (lazyImages.length === 0) return;

      const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const image = entry.target;
          const src = image.getAttribute('data-src');
          if (src) {
            image.src = src;
            image.removeAttribute('data-src');
            image.classList.add('loaded');
          }

          instance.unobserve(image);
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      lazyImages.forEach((image) => observer.observe(image));
    }

    initBackToTop() {
      let button = document.getElementById('backToTop');
      const enabled = this.config.appearance?.enable_back_to_top !== false
        && String(this.config.appearance?.enable_back_to_top).toLowerCase() !== 'false';
      if (!button && enabled) {
        button = document.createElement('button');
        button.id = 'backToTop';
        button.type = 'button';
        button.setAttribute('aria-label', '返回顶部');
        button.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>';
        document.body.appendChild(button);
      }
      if (!button) return;
      button.hidden = false;
      button.style.removeProperty('display');
      if (button.querySelector('.progress-ring-svg')) return;

      const svgNamespace = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNamespace, 'svg');
      svg.setAttribute('viewBox', '0 0 48 48');
      svg.setAttribute('class', 'progress-ring-svg');
      svg.style.cssText = 'position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);transform:rotate(-90deg);pointer-events:none;';

      const circle = document.createElementNS(svgNamespace, 'circle');
      circle.setAttribute('cx', '24');
      circle.setAttribute('cy', '24');
      circle.setAttribute('r', '22');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('stroke-dasharray', '138.23');
      circle.setAttribute('stroke-dashoffset', '138.23');
      circle.setAttribute('stroke-linecap', 'round');
      circle.style.cssText = 'opacity:0.5;transition:stroke-dashoffset 0.25s ease;';

      svg.appendChild(circle);
      button.style.position = 'relative';
      button.appendChild(svg);

      const update = () => {
        const scrollY = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? Math.min(scrollY / docHeight, 1) : 0;

        button.classList.toggle('visible', scrollY > 200);
        circle.setAttribute('stroke-dashoffset', (138.23 * (1 - progress)).toFixed(2));
      };

      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;

        ticking = true;
        window.requestAnimationFrame(() => {
          ticking = false;
          update();
        });
      }, { passive: true });

      button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
      update();
    }

    initSitePopup() {
      const popups = Array.isArray(this.config.interaction?.site_popups)
        ? this.config.interaction.site_popups
        : [];
      const popup = popups.find((item) => item && item.enabled !== false && String(item.enabled).toLowerCase() !== 'false');
      if (!popup) return;

      const id = String(popup.id || popup.title || 'site-popup').trim() || 'site-popup';
      const frequency = popup.frequency || 'session';
      const storageKey = `nucma-site-popup:${id}`;
      const storage = frequency === 'once' ? window.localStorage : window.sessionStorage;
      if (frequency !== 'every' && storage.getItem(storageKey) === 'closed') return;

      const show = () => {
        if (document.querySelector('.site-popup-overlay')) return;
        const resolveAttachmentUrl = (value) => {
          if (!value) return '';
          if (typeof value === 'string') return value.trim();
          if (Array.isArray(value)) return resolveAttachmentUrl(value[0]);
          if (typeof value === 'object') {
            return String(
              value.permalink
              || value.url
              || value.href
              || value.status?.permalink
              || value.spec?.url
              || ''
            ).trim();
          }
          return String(value).trim();
        };
        const imageUrl = resolveAttachmentUrl(popup.image);

        const overlay = document.createElement('div');
        overlay.className = `site-popup-overlay site-popup-overlay--${popup.size || 'medium'}`;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const panel = document.createElement('div');
        panel.className = 'site-popup-panel';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'site-popup-close';
        closeButton.setAttribute('aria-label', '关闭弹窗');
        closeButton.textContent = '×';

        const content = document.createElement('div');
        content.className = 'site-popup-content';

        if (imageUrl) {
          const image = document.createElement('img');
          image.className = 'site-popup-image';
          image.src = imageUrl;
          image.alt = popup.title || '站点弹窗';
          image.loading = 'lazy';
          content.appendChild(image);
        }

        const text = document.createElement('div');
        text.className = 'site-popup-text';

        if (popup.eyebrow) {
          const eyebrow = document.createElement('p');
          eyebrow.className = 'site-popup-eyebrow';
          eyebrow.textContent = popup.eyebrow;
          text.appendChild(eyebrow);
        }

        const title = document.createElement('h2');
        title.className = 'site-popup-title';
        title.textContent = popup.title || '站点公告';
        text.appendChild(title);

        if (popup.content) {
          const body = document.createElement('p');
          body.className = 'site-popup-body';
          body.textContent = popup.content;
          text.appendChild(body);
        }

        const actions = document.createElement('div');
        actions.className = 'site-popup-actions';

        if (popup.primary_text && popup.primary_url) {
          const primary = document.createElement('a');
          primary.className = 'site-popup-button site-popup-button--primary';
          primary.href = String(popup.primary_url);
          primary.textContent = popup.primary_text;
          if (popup.primary_new_window !== false && String(popup.primary_new_window).toLowerCase() !== 'false') {
            primary.target = '_blank';
            primary.rel = 'noopener noreferrer';
          }
          actions.appendChild(primary);
        }

        const secondary = document.createElement('button');
        secondary.type = 'button';
        secondary.className = 'site-popup-button';
        secondary.textContent = popup.secondary_text || '我知道了';
        actions.appendChild(secondary);

        text.appendChild(actions);
        content.appendChild(text);
        panel.append(closeButton, content);
        overlay.appendChild(panel);

        const close = () => {
          overlay.classList.remove('is-visible');
          window.setTimeout(() => overlay.remove(), prefersReducedMotion() ? 0 : 180);
          if (frequency !== 'every') storage.setItem(storageKey, 'closed');
        };

        closeButton.addEventListener('click', close);
        secondary.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) close();
        });
        document.addEventListener('keydown', function onEscape(event) {
          if (event.key !== 'Escape') return;
          document.removeEventListener('keydown', onEscape);
          close();
        });

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('is-visible'));
      };

      const delay = Math.max(0, Number.parseFloat(popup.delay || 0));
      window.setTimeout(show, delay * 1000);
    }

    initPageTools() {
      document.getElementById('themePageTools')?.remove();
    }

    initAccessibility() {
      if (!document.getElementById('themeSkipToContent')) {
        const skipLink = document.createElement('a');
        skipLink.id = 'themeSkipToContent';
        skipLink.href = '#main-content';
        skipLink.textContent = '\u8df3\u5230\u4e3b\u8981\u5185\u5bb9';
        skipLink.className = 'skip-to-content';
        skipLink.style.cssText = 'position:fixed;top:-100px;left:16px;z-index:99999;padding:12px 20px;background:rgb(var(--color-accent));color:rgb(var(--color-on-accent));border-radius:0 0 8px 8px;font-weight:600;font-size:14px;transition:top 0.2s ease;text-decoration:none;';
        skipLink.addEventListener('focus', () => { skipLink.style.top = '0'; });
        skipLink.addEventListener('blur', () => { skipLink.style.top = '-100px'; });
        document.body.insertBefore(skipLink, document.body.firstChild);
      }

      const main = document.querySelector('main');
      if (main && !main.id) {
        main.id = 'main-content';
      }

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        const sidebar = document.getElementById('mobileSidebar');
        if (sidebar && sidebar.style.display === 'block' && typeof window.closeMobileMenu === 'function') {
          window.closeMobileMenu();
          return;
        }

        const lightbox = document.getElementById('lightbox');
        if (lightbox && lightbox.style.display === 'flex') {
          lightbox.style.display = 'none';
          lightbox.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = '';
          return;
        }

        document.querySelectorAll('.fixed.inset-0.z-\\[9999\\], .fixed.inset-0[data-theme-lightbox=\"true\"]').forEach((overlay) => {
          if (overlay.style.display === 'none' || overlay.classList.contains('hidden')) return;
          overlay.remove();
          document.body.style.overflow = '';
        });
      });
    }

  }

  const shell = new ThemeShell(window.themeConfig || {});
  window.themeShell = shell;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => shell.init(), { once: true });
  } else {
    shell.init();
  }
})();
