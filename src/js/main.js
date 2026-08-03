import { initDiagnostics } from './modules/diagnostics.js';

/**
 * NUCMA 国风主题 - 主脚本
 * 统一使用 GSAP 作为动画引擎（入场/滚动显现/计数）
 */
(function() {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof gsap !== 'undefined';
  var hasST = hasGSAP && typeof ScrollTrigger !== 'undefined';
  if (hasST) gsap.registerPlugin(ScrollTrigger);

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

  // ===== 返回顶部：粒子飞升动画 =====
  function initBackToTop() {
    var wrap = document.getElementById('backToTop');
    if (!wrap) return;

    var particleLayer = wrap.querySelector('.bttp-particles-layer');

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

    if (!hasGSAP || prefersReduced) return;

    // --------- 粒子：从一排三角的山顶沿线向上飞升并淡化 ---------
    // 中心三角的山顶坐标（相对 particleLayer，particleLayer 左=0 top=0 与 wrap 同起点）
    // 一排三角的各山顶 x 位置（相对 wrap 左侧）：中心三角左侧 4 个，中心三角，右侧 4 个。
    // 根据 CSS：side-1 宽 48 / side-2 40 / side-3 34 / side-4 28 / side-5 22，margin 均为负数
    // 中心三角 center 宽 72，top=0 在 y=0
    // 粒子发射点 x 大致分布在 wrap 内，从左到右 5+1+5=11 个山峰
    function mountParticle() {
      if (!wrap.classList.contains('visible')) return;
      if (!particleLayer) return;
      if (!document.hasFocus() && Math.random() > 0.25) return; // 非前台少发

      var wrapWidth = wrap.offsetWidth || 260;
      var peaks = 11;
      var peakIdx = Math.floor(Math.random() * peaks); // 0..10
      // 随机加一点抖动，不要每个粒子都对齐山顶正上方
      var jitterX = (Math.random() - 0.5) * 6;
      var startX = (peakIdx + 0.5) / peaks * wrapWidth + jitterX;

      var p = document.createElement('span');
      p.className = 'bttp-particle';
      var size = 2 + Math.random() * 3; // 2..5
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      // 从左到右的颜色微变（主色系—亮色系）
      var hueVar = Math.random() > 0.5 ? 'var(--primary)' : 'var(--primary-light)';
      p.style.background = hueVar;
      p.style.left = startX + 'px';
      p.style.top = '0px';
      p.style.transform = 'translate(-50%, 0)';
      p.style.opacity = '0';
      particleLayer.appendChild(p);

      var riseY = -24 - Math.random() * 22; // 上升 24..46 px
      var sideJitter = (Math.random() - 0.5) * 10;

      // 淡出后立刻 remove
      var tl = gsap.timeline({
        defaults: { ease: 'power1.out' },
        onComplete: function() { p.remove(); }
      });
      tl.fromTo(p,
        { y: 0, x: 0, opacity: 0, scale: 0.4 },
        { y: 0, x: 0, opacity: 0.75 + Math.random() * 0.25, scale: 1, duration: 0.12 + Math.random() * 0.08 }
      );
      tl.to(p, {
        y: riseY,
        x: sideJitter,
        opacity: 0,
        scale: 0.3,
        duration: 1.3 + Math.random() * 0.9,
        ease: 'power2.out'
      }, '<');
    }

    // 周期性发射粒子（总量可控，柔和不抢眼）
    var burstTimer = 0;
    function loopParticles() {
      if (wrap.classList.contains('visible')) {
        mountParticle();
        burstTimer++;
        if (burstTimer % 2 === 0) mountParticle();
        if (burstTimer % 7 === 0) {
          // 偶尔连发 3 个（小喷发）
          setTimeout(mountParticle, 60);
          setTimeout(mountParticle, 130);
        }
      }
      var next = 750 + Math.random() * 850; // 0.75~1.6s 间隔
      setTimeout(loopParticles, next);
    }
    setTimeout(loopParticles, 400);

    // wrap 刚进入可见态时触发一次小爆发（视觉反馈）
    var lastSeen = false;
    var rafObserved = setInterval(function() {
      var seen = wrap.classList.contains('visible');
      if (seen && !lastSeen) {
        for (var i = 0; i < 5; i++) {
          setTimeout(mountParticle, i * 70);
        }
      }
      lastSeen = seen;
    }, 120);
    try { window.addEventListener('beforeunload', function() { clearInterval(rafObserved); }); } catch (_) {}
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

      if (hasGSAP && !prefersReduced) gsap.set(track, { y: 0 });

      function goTo(i) {
        if (hasGSAP && !prefersReduced) {
          gsap.to(track, {
            y: -i * slideH,
            duration: 0.55,
            ease: 'expo.inOut',
            overwrite: true,
            onComplete: function() {
              // 滚到克隆时无缝回到 0
              if (i >= slides.length) {
                gsap.set(track, { y: 0 });
                current = 0;
              }
            }
          });
        } else {
          track.style.transform = 'translateY(' + (-i * slideH) + 'px)';
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

  // ===== 滚动显现动画（GSAP ScrollTrigger，一次性 fromTo，不持续应用 transform） =====
  function initScrollReveal() {
    if (!hasST) return;

    var selector = '.news-item, .member-card, .link-card, .category-card, ' +
      '.faq-item, .archive-timeline-item, .moment-item, .photo-item, ' +
      '.sidebar-card, .section-header-bar, .post-card, .intro-stat';
    var items = document.querySelectorAll(selector);
    if (!items.length) return;

    if (prefersReduced) {
      // 尊重用户偏好，直接显示
      items.forEach(function(el) { gsap.set(el, { opacity: 1, y: 0 }); });
      return;
    }

    items.forEach(function(el) {
      gsap.fromTo(el,
        { opacity: 0, y: 16 },
        {
          opacity: 1, y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            once: true
          }
        }
      );
    });
  }

  // ===== 数字计数动画（GSAP） =====
  function initCountUp() {
    if (!hasST) return;
    var numbers = document.querySelectorAll('.intro-stat-number, .stat-number');
    if (!numbers.length) return;

    numbers.forEach(function(el) {
      var target = parseInt(el.textContent) || 0;
      if (target <= 0 || el.dataset.counted) return;
      el.dataset.counted = 'true';

      var counter = { val: 0 };
      gsap.to(counter, {
        val: target,
        duration: 1.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          once: true
        },
        onUpdate: function() {
          el.textContent = Math.round(counter.val);
        }
      });
    });
  }

  // ===== Banner 入场动画（仅首次加载） =====
  function initBannerAnimation() {
    if (prefersReduced || !hasGSAP) return;
    var banner = document.querySelector('.banner');
    if (!banner) return;

    var logoItems = banner.querySelectorAll('.banner-logo-item');
    var bannerTitle = banner.querySelector('.banner-title');
    var bannerSubtitle = banner.querySelector('.banner-subtitle');

    var tl = gsap.timeline();
    if (logoItems.length) {
      tl.fromTo(logoItems, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out' });
    }
    if (bannerTitle) {
      tl.fromTo(bannerTitle, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.3');
    }
    if (bannerSubtitle) {
      tl.fromTo(bannerSubtitle, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');
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

  // ===== 初始化 =====
  document.addEventListener('DOMContentLoaded', function() {
    initDiagnostics();
    initThemeToggle();
    initBackToTop();
    initHeaderScroll();
    // 先 priority 排序（保留 pinned 顺序），再按 pinned 精确置顶并做数量限制
    initPrioritySort();
    initGridLimit();
    initSectionOrdering();
    initPostTypography();
    initBannerAnimation();
    initHeaderLinksCarousel();
    initHeroBgCarousel();
    // ScrollTrigger 相关动画在 DOM 就绪后注册
    initScrollReveal();
    initCountUp();
  });


})();
