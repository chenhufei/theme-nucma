import { initDiagnostics } from './modules/diagnostics.js';

/**
 * NUCMA 国风主题 - 主脚本
 * 使用浏览器原生 API 实现全站交互与动画。
 */
(function() {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setElementOpen(element, open) {
    if (!element) return;
    element.classList.toggle('is-open', open);
    element.setAttribute('aria-hidden', String(!open));
  }

  // ===== 移动端菜单 =====
  function initMobileMenu() {
    var menu = document.getElementById('mobileMenu');
    var toggle = document.getElementById('mobileMenuToggle');
    if (!menu || !toggle) return;

    var closeButton = menu.querySelector('[data-mobile-menu-close]');
    var overlay = menu.querySelector('.mobile-menu-overlay');
    var links = menu.querySelectorAll('a');
    var desktop = window.matchMedia('(min-width: 769px)');
    var lastFocused = null;

    function openMenu() {
      lastFocused = document.activeElement;
      setElementOpen(menu, true);
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      window.requestAnimationFrame(function() {
        if (closeButton) closeButton.focus();
      });
    }

    function closeMenu(restoreFocus) {
      setElementOpen(menu, false);
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      if (restoreFocus !== false && lastFocused instanceof HTMLElement) lastFocused.focus();
    }

    toggle.addEventListener('click', openMenu);
    if (closeButton) closeButton.addEventListener('click', function() { closeMenu(); });
    if (overlay) overlay.addEventListener('click', function() { closeMenu(); });
    links.forEach(function(link) {
      link.addEventListener('click', function() { closeMenu(false); });
    });
    desktop.addEventListener('change', function(event) {
      if (event.matches) closeMenu(false);
    });
    menu.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusable = Array.from(menu.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function(element) { return !element.hidden && element.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  // ===== 登录入口与用户菜单 =====
  function initLoginMenu() {
    var wrap = document.getElementById('loginEntryWrap');
    var entry = document.getElementById('loginEntry');
    var dropdown = document.getElementById('loginDropdown');
    if (!wrap || !entry || !dropdown) return;

    var icon = entry.querySelector('.login-icon');
    var avatar = entry.querySelector('.login-avatar');
    var placeholder = entry.querySelector('.login-avatar-placeholder');
    var loggedIn = false;
    var pinned = false;
    var openTimer = null;
    var closeTimer = null;

    function clearTimers() {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    }

    function setOpen(open) {
      clearTimers();
      setElementOpen(dropdown, open);
      entry.setAttribute('aria-expanded', String(open));
    }

    function showMenu() {
      if (!loggedIn) return;
      clearTimers();
      openTimer = window.setTimeout(function() { setOpen(true); }, 140);
    }

    function hideMenu() {
      clearTimers();
      if (!pinned) closeTimer = window.setTimeout(function() { setOpen(false); }, 200);
    }

    function closeMenu() {
      pinned = false;
      setOpen(false);
    }

    entry.addEventListener('click', function(event) {
      event.preventDefault();
      if (!loggedIn) {
        window.location.href = '/console';
        return;
      }
      pinned = !pinned;
      setOpen(pinned);
    });
    wrap.addEventListener('pointerenter', showMenu);
    wrap.addEventListener('pointerleave', hideMenu);
    wrap.addEventListener('focusin', showMenu);
    wrap.addEventListener('focusout', function(event) {
      if (!wrap.contains(event.relatedTarget)) hideMenu();
    });
    dropdown.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
    document.addEventListener('pointerdown', function(event) {
      if (!wrap.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') closeMenu();
    });

    fetch('/apis/api.console.halo.run/v1alpha1/users/-', { credentials: 'include' })
      .then(function(response) { return response.ok ? response.json() : null; })
      .then(function(data) {
        if (!data || !data.user) return;
        loggedIn = true;
        wrap.classList.add('is-authenticated');
        var user = data.user;
        var name = user.spec?.displayName || user.metadata?.name || '用户';
        var avatarUrl = user.spec?.avatar;
        entry.title = name;
        entry.setAttribute('aria-label', name);
        if (icon) icon.hidden = true;
        if (avatarUrl && avatar) {
          avatar.src = avatarUrl;
          avatar.alt = name;
          avatar.hidden = false;
        } else if (placeholder) {
          placeholder.hidden = false;
        }
      })
      .catch(function() {});
  }

  // ===== 主题切换 =====
  var themeTransitionTimer = null;
  function initThemeToggle() {
    var toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    toggle.addEventListener('click', function(e) {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      var saved = localStorage.getItem('theme-mode');
      if (saved === 'system' || !saved) applyTheme('system', true);
    });
  }

  function applyTheme(mode, animate) {
    var actual = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    if (animate && !prefersReduced) {
      document.documentElement.classList.add('theme-transitioning');
      window.clearTimeout(themeTransitionTimer);
      themeTransitionTimer = window.setTimeout(function() {
        document.documentElement.classList.remove('theme-transitioning');
      }, 460);
    }
    document.documentElement.setAttribute('data-theme', actual);
    document.documentElement.setAttribute('data-color-scheme', actual);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(actual);
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme', actual);
  }

  // ===== 返回顶部 =====
  function initBackToTop() {
    var wrap = document.getElementById('backToTop');
    if (!wrap) return;

    window.addEventListener('scroll', function() {
      wrap.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });

    wrap.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    wrap.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

  }

  // ===== Header 滚动阴影 =====
  function initHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    window.addEventListener('scroll', function() {
      header.classList.toggle('is-scrolled', window.scrollY > 10);
    }, { passive: true });
  }




  // ===== 导航栏自定义链接上下滚动轮播 =====
  function initHeaderLinksCarousel() {
    var wraps = document.querySelectorAll('.header-links-wrap.is-carousel');
    if (!wraps.length) return;
    wraps.forEach(function(wrap) {
      var track = wrap.querySelector('.header-links-track');
      if (!track) return;
      var slides = track.querySelectorAll('.header-links-slide');
      if (slides.length <= 1) return;

      var interval = parseInt(wrap.dataset.interval || '3500', 10) || 3500;
      var current = 0;
      var slideH = 44; // 与 CSS 保持一致

      // 循环用：在最后复制一张第一张，滚动后无缝回滚
      if (track._carouselInited) return;
      track._carouselInited = true;
      if (slides[0]) {
        var clone = slides[0].cloneNode(true);
        track.appendChild(clone);
      }

      function goTo(i) {
        var duration = prefersReduced ? 0 : 550;
        track.style.transition = duration
          ? 'transform 550ms cubic-bezier(0.16, 1, 0.3, 1)'
          : 'none';
        track.style.transform = 'translateY(' + (-i * slideH) + 'px)';
        if (i >= slides.length) {
          window.setTimeout(function() {
            track.style.transition = 'none';
            track.style.transform = 'translateY(0)';
            current = 0;
            void track.offsetHeight;
          }, duration);
        }
      }

      function next() {
        current++;
        goTo(current);
        if (current >= slides.length) {
          // 动画回调里已经回滚
          current = current % slides.length;
        }
      }

      // 悬停时暂停
      var hover = false;
      wrap.addEventListener('mouseenter', function() { hover = true; });
      wrap.addEventListener('mouseleave', function() { hover = false; });

      setInterval(function() {
        if (!hover) next();
      }, Math.max(1500, interval));
    });
  }

  // ===== Hero 多背景轮播（条形指示线 + 自动轮播 + 点击切换） =====
  function initHeroBgCarousel() {
    var banner = document.querySelector('.banner.has-bg-carousel');
    if (!banner) return;
    var stage = banner.querySelector('.banner-bg-stage');
    var slides = banner.querySelectorAll('.banner-bg-slide');
    var indicators = banner.querySelectorAll('.banner-bg-indicator');
    if (!stage || slides.length < 2) return;

    var interval = parseInt(banner.dataset.bgInterval || '5000', 10) || 5000;
    var current = 0;
    var timer = null;
    var transitionToken = 0;
    var transitionCleanup = null;
    var loadPromises = [];
    // 在 banner 上注入 CSS 变量，让指示条 scaleX 动画时长与轮播间隔一致
    banner.style.setProperty('--hero-bg-duration', (interval / 1000).toFixed(2) + 's');

    function loadSlide(i) {
      if (loadPromises[i]) return loadPromises[i];
      var url = slides[i].getAttribute('data-bg-url');
      if (!url) return Promise.resolve(false);
      loadPromises[i] = new Promise(function(resolve) {
        var image = new Image();
        var settled = false;
        function finish(ok) {
          if (settled) return;
          settled = true;
          resolve(ok);
        }
        image.onload = function() { finish(true); };
        image.onerror = function() { finish(false); };
        image.src = url;
        if (image.complete) finish(image.naturalWidth > 0);
        setTimeout(function() { finish(false); }, 6000);
      });
      return loadPromises[i];
    }

    function updateIndicators(i) {
      indicators.forEach(function(ind, idx) {
        ind.classList.remove('is-active');
        ind.setAttribute('aria-selected', String(idx === i));
        ind.setAttribute('tabindex', idx === i ? '0' : '-1');
        // 触发 CSS scaleX 重播
        ind.style.animation = 'none';
        // eslint-disable-next-line no-unused-expressions
        ind.offsetHeight;
        ind.style.animation = '';
      });
      var ind = indicators[i];
      if (ind) ind.classList.add('is-active');
    }

    function playFrom(i) {
      if (transitionCleanup) {
        clearTimeout(transitionCleanup);
        transitionCleanup = null;
      }
      slides.forEach(function(slide, idx) {
        slide.classList.remove('is-entering');
        slide.classList.toggle('is-active', idx === current);
      });

      var outgoing = slides[current];
      var incoming = slides[i];
      if (!incoming || i === current) {
        updateIndicators(current);
        return;
      }

      slides.forEach(function(slide, idx) {
        if (idx === current || idx === i) return;
        slide.classList.remove('is-active', 'is-entering');
      });

      incoming.classList.remove('is-active', 'is-entering');
      // Commit the transparent state before fading in; the previous image stays underneath.
      void incoming.offsetWidth;
      incoming.classList.add('is-entering');
      transitionCleanup = setTimeout(function() {
        outgoing.classList.remove('is-active');
        incoming.classList.remove('is-entering');
        incoming.classList.add('is-active');
        transitionCleanup = null;
      }, 950);

      current = i;
      updateIndicators(current);
    }

    function requestSlide(i, skipUnavailable) {
      var token = ++transitionToken;
      function trySlide(candidate, remaining) {
        loadSlide(candidate).then(function(ready) {
          if (token !== transitionToken) return;
          if (ready) {
            playFrom(candidate);
            return;
          }
          if (!skipUnavailable || remaining <= 1) return;
          trySlide((candidate + 1) % slides.length, remaining - 1);
        });
      }
      trySlide(i, slides.length - 1);
    }

    function next() {
      requestSlide((current + 1) % slides.length, true);
    }

    function start() {
      stop();
      timer = setInterval(next, interval);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    indicators.forEach(function(ind) {
      var hoverTimer = null;
      ind.addEventListener('click', function() {
        var idx = parseInt(ind.getAttribute('data-index') || '0', 10);
        if (idx === current || isNaN(idx)) return;
        requestSlide(idx);
        start();
      });
      // 悬停指示线一段时间后跳转
      ind.addEventListener('mouseenter', function() {
        hoverTimer = setTimeout(function() {
          var idx = parseInt(ind.getAttribute('data-index') || '0', 10);
          if (idx === current || isNaN(idx)) return;
          requestSlide(idx);
          start();
        }, 300);
      });
      ind.addEventListener('mouseleave', function() {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      });
      ind.addEventListener('keydown', function(e) {
        var target = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (current + 1) % slides.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = (current - 1 + slides.length) % slides.length;
        if (e.key === 'Home') target = 0;
        if (e.key === 'End') target = slides.length - 1;
        if (target === null) return;
        e.preventDefault();
        requestSlide(target);
        if (indicators[target]) indicators[target].focus();
        start();
      });
    });
    banner.addEventListener('mouseenter', stop);
    banner.addEventListener('mouseleave', start);

    updateIndicators(0);
    slides.forEach(function(_, idx) { loadSlide(idx); });
    Promise.all(loadPromises).then(function() {
      updateIndicators(current);
      start();
    });
    try {
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) stop(); else start();
      });
    } catch (_) {}
  }

  // ===== 滚动显现动画 =====
  function initScrollReveal() {
    var selector = '.news-item, .member-card, .link-card, .category-card, ' +
      '.faq-item, .archive-timeline-item, .about-timeline-item, .about-service-item, ' +
      '.moment-item, .photo-item, ' +
      '.sidebar-card, .section-header-bar, .post-card, .intro-stat';
    var items = document.querySelectorAll(selector);
    if (!items.length || prefersReduced || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

    items.forEach(function(element) {
      element.classList.add('scroll-reveal');
      observer.observe(element);
    });
  }

  // ===== 数字计数动画 =====
  function initCountUp() {
    var numbers = document.querySelectorAll('.intro-stat-number, .stat-number');
    if (!numbers.length) return;

    function animate(element) {
      var target = parseInt(element.textContent, 10) || 0;
      if (target <= 0 || element.dataset.counted) return;
      element.dataset.counted = 'true';
      if (prefersReduced) return;
      var startedAt = null;
      function frame(timestamp) {
        if (startedAt === null) startedAt = timestamp;
        var progress = Math.min(1, (timestamp - startedAt) / 1500);
        var eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = String(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(frame);
      }
      element.textContent = '0';
      window.requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) {
      numbers.forEach(animate);
      return;
    }
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    numbers.forEach(function(element) { observer.observe(element); });
  }

  // ===== Banner 入场动画（仅首次加载） =====
  function initBannerAnimation() {
    if (prefersReduced || !Element.prototype.animate) return;
    var banner = document.querySelector('.banner');
    if (!banner) return;

    var logoItems = banner.querySelectorAll('.banner-logo-item');
    var bannerTitle = banner.querySelector('.banner-title');
    var bannerSubtitle = banner.querySelector('.banner-subtitle');

    var delay = 0;
    logoItems.forEach(function(element, index) {
      element.animate(
        [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 600, delay: index * 120, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
      );
      delay = index * 120 + 240;
    });
    if (bannerTitle) {
      bannerTitle.animate(
        [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 800, delay: delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
      );
    }
    if (bannerSubtitle) {
      bannerSubtitle.animate(
        [{ opacity: 0, transform: 'translateY(15px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 600, delay: delay + 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
      );
    }
  }

  // ===== 首页卡片排序（pinned 优先，严格按 metadata.name 相等匹配） + 数量限制（pinned 不受限） =====
  function initGridLimit() {
    document.querySelectorAll('[data-limit]').forEach(function(grid) {
      var limit = parseInt(grid.dataset.limit) || 0;
      var pinnedRaw = grid.dataset.pinnedIds || '';
      var pinnedIds = pinnedRaw
        .split(',')
        .map(function(s) { return (s || '').trim(); })
        .filter(function(s) { return s.length > 0; });
      var cardSelector = grid.classList.contains('member-grid')
        ? '.member-card'
        : (grid.classList.contains('link-grid') ? '.link-card' : '.member-card, .link-card');
      var cards = Array.from(grid.querySelectorAll(cardSelector));

      if (pinnedIds.length > 0) {
        var pinnedCards = [];
        var otherCards = [];
        cards.forEach(function(card) {
          var id = (card.dataset.id || '').toString().trim();
          if (!id) { otherCards.push(card); return; }
          // 严格全等匹配：只有 pinnedIds 中完全相同的 id 才算固定
          var rank = pinnedIds.indexOf(id);
          if (rank >= 0) {
            pinnedCards.push({ card: card, rank: rank });
          } else {
            otherCards.push(card);
          }
        });
        pinnedCards.sort(function(a, b) { return a.rank - b.rank; });
        var pinnedOnly = pinnedCards.map(function(x) { return x.card; });
        var ordered = pinnedOnly.concat(otherCards);
        // 全部按顺序重新 appendChild，保证 pinned 全部最前
        ordered.forEach(function(card) { grid.appendChild(card); });
        cards = ordered;

        // 数量限制：只限制 otherCards，pinned 的卡永远保留
        if (limit > 0 && pinnedOnly.length < limit) {
          var remain = limit - pinnedOnly.length;
          otherCards.forEach(function(card, i) {
            card.style.display = i >= remain ? 'none' : '';
          });
          // pinned 的卡确保显示
          pinnedOnly.forEach(function(card) { card.style.display = ''; });
        } else if (limit > 0) {
          // pinned 数已经超过 limit，pinned 仍然全部显示，other 全部隐藏
          pinnedOnly.forEach(function(card) { card.style.display = ''; });
          otherCards.forEach(function(card) { card.style.display = 'none'; });
        }
      } else {
        // 无 pinned：正常全局 limit
        if (limit > 0) {
          cards.forEach(function(card, i) {
            card.style.display = i >= limit ? 'none' : '';
          });
        }
      }
    });
  }

  // ===== 按 priority 预排序（只对非 pinned 部分排序，避免打乱 pinned 顺序） =====
  function initPrioritySort() {
    var selectors = ['.member-grid', '.link-grid'];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(grid) {
        var pinnedRaw = grid.dataset.pinnedIds || '';
        var pinnedIds = pinnedRaw
          .split(',')
          .map(function(s) { return (s || '').trim(); })
          .filter(function(s) { return s.length > 0; });
        var cards = Array.from(grid.children);

        // 只按 priority 排序，后续 initGridLimit 会把 pinned 提到最前并固定顺序
        cards.sort(function(a, b) {
          var pa = parseInt(a.getAttribute('data-priority') || '0', 10);
          var pb = parseInt(b.getAttribute('data-priority') || '0', 10);
          // 首先 pinned 在前，其他在后
          var idA = (a.getAttribute('data-id') || '').toString().trim();
          var idB = (b.getAttribute('data-id') || '').toString().trim();
          var pinnedA = pinnedIds.indexOf(idA) >= 0 ? 0 : 1;
          var pinnedB = pinnedIds.indexOf(idB) >= 0 ? 0 : 1;
          if (pinnedA !== pinnedB) return pinnedA - pinnedB;
          // 同为 pinned 时按 pinned 顺序
          if (pinnedA === 0) {
            var ra = pinnedIds.indexOf(idA);
            var rb = pinnedIds.indexOf(idB);
            if (ra !== rb) return ra - rb;
          }
          return pb - pa;
        });
        cards.forEach(function(card) { grid.appendChild(card); });
      });
    });
  }

  // ===== 可配置的首页/文章侧栏排序 =====
  function applyConfiguredOrder(container, itemSelector, order) {
    if (!container || !order.length) return;
    var items = Array.from(container.querySelectorAll(itemSelector));
    var byKey = {};
    items.forEach(function(item) {
      var key = item.dataset.homeSection || item.dataset.sidebarSection;
      if (key) byKey[key] = item;
    });
    order.forEach(function(key) {
      if (byKey[key]) container.appendChild(byKey[key]);
    });
  }

  function initSectionOrdering() {
    var home = document.querySelector('.home-sections[data-section-order]');
    if (home) {
      applyConfiguredOrder(home, '[data-home-section]', (home.dataset.sectionOrder || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean));
    }
    var sidebar = document.querySelector('.post-sidebar[data-sidebar-order]');
    if (sidebar) {
      applyConfiguredOrder(sidebar, '[data-sidebar-section]', (sidebar.dataset.sidebarOrder || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean));
    }
  }

  // ===== 文章排版：仅对中文正文启用段落首行缩进 =====
  function initPostTypography() {
    var content = document.querySelector('.post-content.prose');
    if (!content) return;
    var text = (content.textContent || '').trim();
    var firstParagraph = content.querySelector('p');
    var firstText = firstParagraph ? (firstParagraph.textContent || '').trim() : '';
    var hasCjk = /[\u3400-\u9fff]/.test(text.slice(0, 1600));
    var letterOpening = /^(尊敬的|亲爱的|致|敬启者|您好|Dear\b|To whom it may concern\b|Hi\b|Hello\b)/i.test(firstText);
    if (hasCjk && !letterOpening) content.classList.add('prose--cjk');
    if (letterOpening || !hasCjk) content.classList.add('prose--letter');
  }

  // ===== 文章阅读进度 =====
  function initReadingProgress() {
    var progress = document.getElementById('readingProgress');
    var content = document.querySelector('.post-content.prose');
    if (!progress || !content) return;
    var bar = progress.querySelector('.reading-progress__bar');
    if (!bar) return;

    var frame = null;
    var lastValue = -1;
    function update() {
      frame = null;
      var rect = content.getBoundingClientRect();
      var contentTop = rect.top + window.scrollY;
      var start = Math.max(0, contentTop - 80);
      var end = Math.max(start + 1, contentTop + content.offsetHeight - window.innerHeight);
      var ratio = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
      var value = Math.round(ratio * 100);
      bar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      if (value !== lastValue) {
        progress.setAttribute('aria-valuenow', String(value));
        lastValue = value;
      }
    }
    function requestUpdate() {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(requestUpdate).observe(content);
    }
    update();
  }

  // ===== 文章目录：桌面侧栏与移动抽屉共享同一份标题数据 =====
  function initArticleToc() {
    var content = document.querySelector('.post-content.prose');
    var desktopToc = document.getElementById('toc');
    var desktopCard = document.getElementById('tocCard');
    var mobileToc = document.getElementById('mobileToc');
    var mobileToggle = document.getElementById('mobileTocToggle');
    var drawer = document.getElementById('mobileTocDrawer');
    if (!content || (!desktopToc && !mobileToc)) return;

    var headings = Array.from(content.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(function(heading) {
      return (heading.textContent || '').trim().length > 0;
    });
    if (!headings.length) {
      if (desktopCard) desktopCard.hidden = true;
      if (mobileToggle) mobileToggle.hidden = true;
      if (drawer) drawer.hidden = true;
      return;
    }

    var usedIds = {};
    var minLevel = Math.min.apply(null, headings.map(function(heading) {
      return parseInt(heading.tagName.slice(1), 10);
    }));
    headings.forEach(function(heading, index) {
      var base = (heading.id || heading.textContent || 'heading-' + index).toString().trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '') || ('heading-' + index);
      var id = base;
      var suffix = 2;
      while (usedIds[id] || (document.getElementById(id) && document.getElementById(id) !== heading)) {
        id = base + '-' + suffix++;
      }
      usedIds[id] = true;
      heading.id = id;
    });

    function buildList(target) {
      if (!target) return;
      var list = document.createElement('ul');
      headings.forEach(function(heading, index) {
        var level = parseInt(heading.tagName.slice(1), 10);
        var item = document.createElement('li');
        item.style.setProperty('--toc-depth', String(Math.max(0, level - minLevel)));
        var link = document.createElement('a');
        link.href = '#' + heading.id;
        link.textContent = (heading.textContent || '').trim();
        link.dataset.tocIndex = String(index);
        link.setAttribute('aria-label', link.textContent);
        item.appendChild(link);
        list.appendChild(item);
      });
      target.replaceChildren(list);
    }

    buildList(desktopToc);
    buildList(mobileToc);
    if (desktopCard) desktopCard.hidden = false;
    if (mobileToggle) mobileToggle.hidden = false;
    if (drawer) {
      drawer.hidden = false;
      drawer.setAttribute('aria-hidden', 'true');
    }

    var closeTimer = null;
    var mobileMedia = window.matchMedia('(max-width: 1024px)');
    function finishDrawerClose(restoreFocus) {
      if (!drawer) return;
      if (drawer.open && typeof drawer.close === 'function') drawer.close();
      else drawer.removeAttribute('open');
      if (restoreFocus && mobileToggle) mobileToggle.focus();
    }
    function closeDrawer(restoreFocus) {
      if (!drawer || !drawer.open) return;
      window.clearTimeout(closeTimer);
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('mobile-toc-open');
      if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
      if (prefersReduced) finishDrawerClose(restoreFocus);
      else closeTimer = window.setTimeout(function() { finishDrawerClose(restoreFocus); }, 220);
    }
    function openDrawer() {
      if (!drawer || !mobileMedia.matches) return;
      window.clearTimeout(closeTimer);
      if (!drawer.open) {
        if (typeof drawer.showModal === 'function') drawer.showModal();
        else drawer.setAttribute('open', '');
      }
      drawer.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('mobile-toc-open');
      if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(function() {
        drawer.classList.add('is-open');
        var closeButton = drawer.querySelector('[data-toc-close]');
        if (closeButton) closeButton.focus();
      });
    }

    if (mobileToggle && drawer) {
      mobileToggle.addEventListener('click', openDrawer);
      var closeButton = drawer.querySelector('[data-toc-close]');
      if (closeButton) closeButton.addEventListener('click', function() { closeDrawer(true); });
      drawer.addEventListener('cancel', function(event) {
        event.preventDefault();
        closeDrawer(true);
      });
      drawer.addEventListener('click', function(event) {
        if (event.target === drawer) closeDrawer(true);
      });
      drawer.addEventListener('close', function() {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('mobile-toc-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
      mobileToc.addEventListener('click', function(event) {
        if (event.target.closest('a')) closeDrawer(false);
      });
      mobileMedia.addEventListener('change', function(event) {
        if (!event.matches) closeDrawer(false);
      });
    }

    var tocLinks = Array.from(document.querySelectorAll('.toc a[data-toc-index]'));
    var currentFrame = null;
    function updateCurrent() {
      currentFrame = null;
      var currentIndex = 0;
      headings.forEach(function(heading, index) {
        if (heading.getBoundingClientRect().top <= 110) currentIndex = index;
      });
      tocLinks.forEach(function(link) {
        var active = parseInt(link.dataset.tocIndex || '-1', 10) === currentIndex;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    function requestCurrentUpdate() {
      if (currentFrame !== null) return;
      currentFrame = window.requestAnimationFrame(updateCurrent);
    }
    window.addEventListener('scroll', requestCurrentUpdate, { passive: true });
    updateCurrent();
  }

  // ===== 文章图片查看器 =====
  function initArticleImageViewer() {
    var content = document.querySelector('.post-content.prose');
    var viewer = document.getElementById('articleImageViewer');
    if (!content || !viewer) return;
    var viewerImage = document.getElementById('articleImageViewerImage');
    var canvas = document.getElementById('articleImageViewerCanvas');
    var counter = document.getElementById('articleImageViewerCounter');
    var caption = document.getElementById('articleImageViewerCaption');
    var zoomValue = document.getElementById('articleImageViewerZoom');
    var previousButton = viewer.querySelector('[data-image-viewer-prev]');
    var nextButton = viewer.querySelector('[data-image-viewer-next]');
    if (!viewerImage || !canvas || !counter || !caption || !zoomValue || !previousButton || !nextButton) return;

    var currentImages = [];
    var currentIndex = 0;
    var scale = 1;
    var panX = 0;
    var panY = 0;
    var dragging = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragOriginX = 0;
    var dragOriginY = 0;
    var previousFocus = null;
    var closeTimer = null;

    function isEligible(image) {
      if (!image || image.closest('a, button')) return false;
      if (image.matches('[data-no-viewer], [data-image-viewer="false"], .emoji, .emojione, .katex img')) return false;
      if (image.closest('[data-no-viewer], .emoji, .emojione, .katex')) return false;
      return !(image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth <= 160 && image.naturalHeight <= 160);
    }
    function refreshImageState(image) {
      var eligible = isEligible(image);
      image.classList.toggle('article-viewer-image', eligible);
      if (eligible) {
        image.setAttribute('aria-haspopup', 'dialog');
        if (!image.hasAttribute('tabindex')) {
          image.setAttribute('tabindex', '0');
          image.dataset.viewerTabindexAdded = 'true';
        }
      } else {
        image.removeAttribute('aria-haspopup');
        if (image.dataset.viewerTabindexAdded === 'true') {
          image.removeAttribute('tabindex');
          delete image.dataset.viewerTabindexAdded;
        }
      }
    }
    var sourceImages = Array.from(content.querySelectorAll('img'));
    sourceImages.forEach(function(image) {
      refreshImageState(image);
      if (!image.complete) image.addEventListener('load', function() { refreshImageState(image); }, { once: true });
    });
    function collectImages() {
      return sourceImages.filter(isEligible);
    }
    function imageCaption(image) {
      var figure = image.closest('figure');
      var figureCaption = figure ? figure.querySelector('figcaption') : null;
      return ((figureCaption && figureCaption.textContent) || image.getAttribute('alt') || image.getAttribute('title') || '').trim();
    }
    function applyTransform() {
      viewerImage.style.transform = 'translate3d(' + panX + 'px,' + panY + 'px,0) scale(' + scale.toFixed(2) + ')';
      zoomValue.textContent = Math.round(scale * 100) + '%';
      canvas.classList.toggle('is-zoomed', scale > 1);
    }
    function resetTransform() {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    }
    function setScale(nextScale) {
      scale = Math.min(4, Math.max(1, nextScale));
      if (scale === 1) {
        panX = 0;
        panY = 0;
      }
      applyTransform();
    }
    function renderImage() {
      var source = currentImages[currentIndex];
      if (!source) return;
      resetTransform();
      viewerImage.src = source.currentSrc || source.src;
      viewerImage.alt = source.getAttribute('alt') || '文章图片';
      counter.textContent = (currentIndex + 1) + ' / ' + currentImages.length;
      caption.textContent = imageCaption(source);
      caption.hidden = !caption.textContent;
      previousButton.disabled = currentImages.length <= 1;
      nextButton.disabled = currentImages.length <= 1;
    }
    function showImage(offset) {
      if (!currentImages.length) return;
      currentIndex = (currentIndex + offset + currentImages.length) % currentImages.length;
      renderImage();
    }
    function finishViewerClose() {
      if (viewer.open && typeof viewer.close === 'function') viewer.close();
      else viewer.removeAttribute('open');
      viewerImage.removeAttribute('src');
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }
    function closeViewer() {
      if (!viewer.open) return;
      window.clearTimeout(closeTimer);
      viewer.classList.remove('is-open');
      document.documentElement.classList.remove('image-viewer-open');
      if (prefersReduced) finishViewerClose();
      else closeTimer = window.setTimeout(finishViewerClose, 180);
    }
    function openViewer(image) {
      currentImages = collectImages();
      currentIndex = currentImages.indexOf(image);
      if (currentIndex < 0) return;
      previousFocus = document.activeElement;
      viewer.hidden = false;
      renderImage();
      if (!viewer.open) {
        if (typeof viewer.showModal === 'function') viewer.showModal();
        else viewer.setAttribute('open', '');
      }
      document.documentElement.classList.add('image-viewer-open');
      window.requestAnimationFrame(function() {
        viewer.classList.add('is-open');
        var closeButton = viewer.querySelector('[data-image-viewer-close]');
        if (closeButton) closeButton.focus();
      });
    }

    content.addEventListener('click', function(event) {
      var image = event.target.closest('img');
      if (!isEligible(image)) return;
      event.preventDefault();
      openViewer(image);
    });
    content.addEventListener('keydown', function(event) {
      var image = event.target.closest('img.article-viewer-image');
      if (!image || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      openViewer(image);
    });
    viewer.querySelector('[data-image-viewer-close]').addEventListener('click', closeViewer);
    previousButton.addEventListener('click', function() { showImage(-1); });
    nextButton.addEventListener('click', function() { showImage(1); });
    viewer.querySelector('[data-image-viewer-zoom-out]').addEventListener('click', function() { setScale(scale - 0.25); });
    viewer.querySelector('[data-image-viewer-zoom-in]').addEventListener('click', function() { setScale(scale + 0.25); });
    viewer.querySelector('[data-image-viewer-reset]').addEventListener('click', resetTransform);
    viewer.addEventListener('cancel', function(event) {
      event.preventDefault();
      closeViewer();
    });
    viewer.addEventListener('click', function(event) {
      if (event.target === viewer) closeViewer();
    });
    viewer.addEventListener('close', function() {
      viewer.classList.remove('is-open');
      document.documentElement.classList.remove('image-viewer-open');
    });
    viewer.addEventListener('keydown', function(event) {
      if (event.key === 'ArrowLeft') showImage(-1);
      if (event.key === 'ArrowRight') showImage(1);
      if (event.key === '+' || event.key === '=') setScale(scale + 0.25);
      if (event.key === '-') setScale(scale - 0.25);
      if (event.key === '0') resetTransform();
    });
    canvas.addEventListener('wheel', function(event) {
      event.preventDefault();
      setScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
    }, { passive: false });
    canvas.addEventListener('dblclick', resetTransform);
    canvas.addEventListener('pointerdown', function(event) {
      if (scale <= 1 || event.button !== 0) return;
      dragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragOriginX = panX;
      dragOriginY = panY;
      canvas.classList.add('is-dragging');
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', function(event) {
      if (!dragging) return;
      panX = dragOriginX + event.clientX - dragStartX;
      panY = dragOriginY + event.clientY - dragStartY;
      applyTransform();
    });
    function stopDragging(event) {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('is-dragging');
      if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);
  }

  function initHistoryBackLinks() {
    document.querySelectorAll('[data-history-back]').forEach(function(link) {
      link.addEventListener('click', function(event) {
        if (window.history.length <= 1) return;
        event.preventDefault();
        window.history.back();
      });
    });
  }

  function initWidgetOpeners() {
    document.querySelectorAll('[data-widget-open]').forEach(function(button) {
      button.addEventListener('click', function() {
        var widgetName = button.getAttribute('data-widget-open');
        var widget = widgetName && window[widgetName];
        if (widget && typeof widget.open === 'function') widget.open();
      });
    });
  }

  function initDaisyUIAdapters() {
    document.querySelectorAll('.pagination').forEach(function(element) {
      element.classList.add('join');
    });
    document.querySelectorAll('.empty-state').forEach(function(element) {
      element.classList.add('alert', 'alert-soft', 'alert-vertical');
    });
    document.querySelectorAll('.page-btn').forEach(function(element) {
      element.classList.add('btn', 'btn-outline', 'btn-sm', 'join-item');
    });
    document.querySelectorAll('.page-info').forEach(function(element) {
      element.classList.add('badge', 'badge-ghost');
    });
    document.querySelectorAll('.about-service-badge, .link-filter-count, .member-filter-count, .photo-filter-count, .moment-tag-count').forEach(function(element) {
      element.classList.add('badge', 'badge-sm', 'badge-soft');
    });
  }

  // ===== 初始化 =====
  function initTheme() {
    if (document.documentElement.dataset.nucmaInitialized === 'true') return;
    document.documentElement.dataset.nucmaInitialized = 'true';

    initDiagnostics();
    initThemeToggle();
    initBackToTop();
    initHeaderScroll();
    initMobileMenu();
    initLoginMenu();
    // 先 priority 排序（保留 pinned 顺序），再按 pinned 精确置顶并做数量限制
    initPrioritySort();
    initGridLimit();
    initSectionOrdering();
    initPostTypography();
    initReadingProgress();
    initArticleToc();
    initArticleImageViewer();
    initHistoryBackLinks();
    initWidgetOpeners();
    initDaisyUIAdapters();
    initBannerAnimation();
    initHeaderLinksCarousel();
    initHeroBgCarousel();
    initScrollReveal();
    initCountUp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme, { once: true });
  } else {
    initTheme();
  }


})();
