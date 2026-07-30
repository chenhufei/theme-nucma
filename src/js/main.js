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

  // ===== 主题切换（圆形波纹扩散——渐变波纹避免纯白/纯黑突兀） =====
  // 策略：
  // 1. 禁用元素自身的 CSS transition（theme-transitioning → transition: none），避免原生过渡色造成中间态闪白/黑；
  // 2. 波纹使用径向渐变，从"次色"扩散到"目标色"，视觉上不会出现大片纯色突兀；
  // 3. 波纹覆盖到 75% 时立即切换主题（GSAP 回调约在 0.7 progress 时），此时绝大部分已被渐变覆盖，切换无感知；
  // 4. 最后波纹淡出并移除。
  function initThemeToggle() {
    var toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    var animating = false;
    toggle.addEventListener('click', function(e) {
      if (animating) return;
      animating = true;

      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';

      var rect = toggle.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;

      var maxRadius = Math.max(
        Math.hypot(x, y),
        Math.hypot(window.innerWidth - x, y),
        Math.hypot(x, window.innerHeight - y),
        Math.hypot(window.innerWidth - x, window.innerHeight - y)
      );

      var ripple = document.createElement('div');
      ripple.className = 'theme-ripple';
      ripple.setAttribute('data-next', next); // 触发 CSS 里的渐变配色
      ripple.style.left = (x - maxRadius) + 'px';
      ripple.style.top = (y - maxRadius) + 'px';
      ripple.style.width = (maxRadius * 2) + 'px';
      ripple.style.height = (maxRadius * 2) + 'px';
      ripple.style.transformOrigin = 'center center';
      ripple.style.transform = 'scale(0)';
      ripple.style.opacity = '1';
      document.body.appendChild(ripple);

      // 暂停所有元素的原生 CSS transition，防止"半过渡色"造成白屏/黑屏
      document.documentElement.classList.add('theme-transitioning');

      if (hasGSAP && !prefersReduced) {
        var themeSwitched = false;
        // 快速扩散，用 power3 让边缘柔和
        gsap.to(ripple, {
          scale: 1,
          duration: 0.52,
          ease: 'power3.out',
          onUpdate: function() {
            // 在波纹覆盖 ~70% 时切换主题，视觉上无突兀纯色
            if (!themeSwitched && this.progress() >= 0.72) {
              themeSwitched = true;
              applyTheme(next);
            }
          },
          onComplete: function() {
            if (!themeSwitched) applyTheme(next);
            // 立即淡出，去掉波纹让新主题直接接管
            gsap.to(ripple, {
              opacity: 0,
              duration: 0.22,
              ease: 'power1.out',
              onComplete: function() {
                ripple.remove();
                document.documentElement.classList.remove('theme-transitioning');
                animating = false;
              }
            });
          }
        });
      } else {
        applyTheme(next);
        setTimeout(function() {
          ripple.remove();
          document.documentElement.classList.remove('theme-transitioning');
          animating = false;
        }, 320);
      }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      var saved = localStorage.getItem('theme-mode');
      if (saved === 'system' || !saved) applyTheme('system');
    });
  }

  function applyTheme(mode) {
    var actual = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.setAttribute('data-theme', actual);
    document.documentElement.setAttribute('data-color-scheme', actual);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(actual);
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme', actual);
  }

  // ===== 移动端菜单 =====
  function openMobileMenu() {
    var menu = document.getElementById('mobileMenu');
    if (menu) { menu.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  }
  function closeMobileMenu() {
    var menu = document.getElementById('mobileMenu');
    if (menu) { menu.classList.remove('is-open'); document.body.style.overflow = ''; }
  }
  function initMobileMenu() {
    var btn = document.getElementById('mobileMenuBtn');
    if (btn) btn.addEventListener('click', openMobileMenu);
  }

  // ===== 返回顶部：粒子飞升动画 + 鼠标跟随指示器（山顶指向鼠标） =====
  function initBackToTop() {
    var wrap = document.getElementById('backToTop');
    if (!wrap) return;

    var particleLayer = wrap.querySelector('.bttp-particles-layer');
    var pointer = wrap.querySelector('.bttp-pointer');
    var pointerTip = wrap.querySelector('.bttp-pointer-tip');

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

    // --------- 指示器：大三角的山顶指向鼠标 ---------
    function updatePointer() {
      if (!wrap.classList.contains('visible')) return;
      if (!pointer || !pointerTip) return;

      var wrapRect = wrap.getBoundingClientRect();
      var tipClientX = wrapRect.left + wrapRect.width / 2;
      var tipClientY = wrapRect.top + 0; // 三角的 top 对齐山顶
      var dx = (pointer._lastMouseX || tipClientX) - tipClientX;
      var dy = (pointer._lastMouseY || tipClientY) - tipClientY;

      // 只有当鼠标在页面上方 90% 区域才跟随；否则保持默认指向上方
      var angleDeg = 0;
      if (dy < 0 || Math.abs(dx) > 12) {
        // atan2(dy, dx) 以"向右为 0°、向下为 90°"。我们要以"向上为 0°"：
        var rad = Math.atan2(dx, -dy); // 0°=向上，正=向右偏
        angleDeg = rad * 180 / Math.PI;
        // 限制在 -75° ~ +75°，避免太夸张
        if (angleDeg > 75) angleDeg = 75;
        if (angleDeg < -75) angleDeg = -75;
      }
      gsap.to(pointerTip, {
        rotation: angleDeg,
        duration: 0.35,
        ease: 'power2.out',
        overwrite: true
      });
    }

    document.addEventListener('mousemove', function(e) {
      if (!wrap.classList.contains('visible')) return;
      pointer._lastMouseX = e.clientX;
      pointer._lastMouseY = e.clientY;
      if (!pointer._raf) {
        pointer._raf = requestAnimationFrame(function() {
          pointer._raf = null;
          updatePointer();
        });
      }
    }, { passive: true });

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

  // ===== FAQ（纯 GSAP 展开动画——高度+箭头旋转+内容淡入） =====
  function toggleFaq(btn) {
    var item = btn.closest('.faq-item');
    if (!item) return;
    var answer = item.querySelector('.faq-answer');
    var icon = btn.querySelector('.faq-icon');
    var content = answer ? answer.querySelector('p') : null;

    // 先关闭其他已展开的
    document.querySelectorAll('.faq-item.active').forEach(function(other) {
      if (other === item) return;
      other.classList.remove('active');
      var otherAnswer = other.querySelector('.faq-answer');
      var otherIcon = other.querySelector('.faq-icon');
      var otherContent = otherAnswer ? otherAnswer.querySelector('p') : null;
      if (!hasGSAP || prefersReduced) {
        if (otherAnswer) otherAnswer.style.height = '0px';
        return;
      }
      gsap.killTweensOf([otherAnswer, otherIcon, otherContent].filter(Boolean));
      gsap.to(otherIcon, { rotation: 0, scale: 1, duration: 0.28, ease: 'power2.inOut' });
      if (otherContent) {
        gsap.to(otherContent, {
          y: -8, opacity: 0, duration: 0.18, ease: 'power1.in'
        });
      }
      if (otherAnswer) {
        gsap.to(otherAnswer, {
          height: 0,
          duration: 0.36,
          ease: 'power2.inOut',
          overwrite: true
        });
      }
    });

    var isActive = item.classList.contains('active');
    if (isActive) {
      // 收起当前
      item.classList.remove('active');
      if (!hasGSAP || prefersReduced) {
        if (answer) answer.style.height = '0px';
        return;
      }
      gsap.killTweensOf([answer, icon, content].filter(Boolean));
      gsap.to(icon, { rotation: 0, scale: 1, duration: 0.28, ease: 'power2.inOut' });
      if (content) {
        gsap.to(content, {
          y: -8, opacity: 0, duration: 0.18, ease: 'power1.in'
        });
      }
      if (answer) {
        gsap.to(answer, {
          height: 0,
          duration: 0.36,
          ease: 'power2.inOut',
          overwrite: true
        });
      }
    } else {
      // 展开当前
      item.classList.add('active');
      if (!hasGSAP || prefersReduced) {
        if (answer) answer.style.height = 'auto';
        return;
      }
      gsap.killTweensOf([answer, icon, content].filter(Boolean));
      gsap.to(icon, { rotation: 180, scale: 1.1, duration: 0.32, ease: 'back.out(1.4)' });

      var tl = gsap.timeline({ defaults: { overwrite: true } });
      if (answer) {
        // 先 clear height，用 auto 的方式取 scrollHeight，避免估错
        var targetHeight = answer.scrollHeight || 0;
        tl.fromTo(answer,
          { height: 0 },
          { height: targetHeight, duration: 0.44, ease: 'expo.out' },
          0
        );
      }
      if (content) {
        tl.fromTo(content,
          { y: -8, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.36, ease: 'power2.out' },
          0.1
        );
      }
    }
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
    // 在 banner 上注入 CSS 变量，让指示条 scaleX 动画时长与轮播间隔一致
    banner.style.setProperty('--hero-bg-duration', (interval / 1000).toFixed(2) + 's');

    function playFrom(i) {
      // 先清所有
      slides.forEach(function(s, idx) {
        if (idx === i) return;
        s.classList.remove('is-active');
        if (hasGSAP && !prefersReduced) {
          gsap.killTweensOf(s);
          gsap.set(s, { opacity: 0, scale: 1.04 });
        }
      });
      indicators.forEach(function(ind, idx) {
        ind.classList.remove('is-active');
        // 触发 CSS scaleX 重播
        ind.style.animation = 'none';
        // eslint-disable-next-line no-unused-expressions
        ind.offsetHeight;
        ind.style.animation = '';
      });

      var cur = slides[i];
      cur.classList.add('is-active');
      var ind = indicators[i];
      if (ind) ind.classList.add('is-active');

      if (hasGSAP && !prefersReduced) {
        gsap.killTweensOf(cur);
        gsap.fromTo(cur,
          { opacity: 0, scale: 1.04 },
          { opacity: 1, scale: 1, duration: 1.0, ease: 'power3.out' }
        );
      }
    }

    function next() {
      current = (current + 1) % slides.length;
      playFrom(current);
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
        current = idx;
        playFrom(current);
        start();
      });
      // 悬停指示线一段时间后跳转
      ind.addEventListener('mouseenter', function() {
        hoverTimer = setTimeout(function() {
          var idx = parseInt(ind.getAttribute('data-index') || '0', 10);
          if (idx === current || isNaN(idx)) return;
          current = idx;
          playFrom(current);
          start();
        }, 300);
      });
      ind.addEventListener('mouseleave', function() {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      });
    });
    banner.addEventListener('mouseenter', stop);
    banner.addEventListener('mouseleave', start);

    playFrom(0);
    start();
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

  // ===== 登录状态检测 + 点击/hover 弹出菜单 =====
  function initLoginEntry() {
    var entry = document.getElementById('loginEntry');
    var dropdown = document.getElementById('loginDropdown');
    var wrap = document.getElementById('loginEntryWrap');
    if (!entry || !dropdown) return;
    var isLoggedIn = false;

    function openDropdown() {
      dropdown.classList.add('is-open');
      entry.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
      dropdown.classList.remove('is-open');
      entry.setAttribute('aria-expanded', 'false');
    }

    entry.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoggedIn) {
        window.location.href = '/console';
        return;
      }
      if (dropdown.classList.contains('is-open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    if (wrap) {
      wrap.addEventListener('mouseleave', function() {
        if (isLoggedIn) closeDropdown();
      });
    }

    document.addEventListener('click', function(e) {
      if (!isLoggedIn) return;
      if (!entry.contains(e.target) && !dropdown.contains(e.target)) {
        closeDropdown();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isLoggedIn) closeDropdown();
    });

    fetch('/apis/api.console.halo.run/v1alpha1/users/-', { credentials: 'include' })
      .then(function(res) { return res.ok ? res.json() : null; })
      .then(function(data) {
        if (data && data.user) {
          isLoggedIn = true;
          var user = data.user;
          var avatar = user.spec && user.spec.avatar ? user.spec.avatar : '';
          var name = user.spec && user.spec.displayName ? user.spec.displayName : (user.metadata && user.metadata.name ? user.metadata.name : '用户');
          entry.title = name;
          entry.innerHTML = '';
          if (avatar) {
            var img = document.createElement('img');
            img.className = 'login-avatar';
            img.src = avatar;
            img.alt = name;
            entry.appendChild(img);
          } else {
            var placeholder = document.createElement('span');
            placeholder.className = 'login-avatar-placeholder';
            placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;border:2px solid var(--bg-primary);';
            placeholder.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';
            entry.appendChild(placeholder);
          }
          var loginLink = dropdown.querySelector('.login-menu-login');
          var ucLink = dropdown.querySelector('.login-menu-uc');
          var logoutLink = dropdown.querySelector('.login-menu-logout');
          if (loginLink) loginLink.style.display = 'none';
          if (ucLink) ucLink.style.display = '';
          if (logoutLink) logoutLink.style.display = '';
        }
      })
      .catch(function() {});
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

  // ===== 初始化 =====
  document.addEventListener('DOMContentLoaded', function() {
    initThemeToggle();
    initMobileMenu();
    initBackToTop();
    initHeaderScroll();
    initLoginEntry();
    // 先 priority 排序（保留 pinned 顺序），再按 pinned 精确置顶并做数量限制
    initPrioritySort();
    initGridLimit();
    initBannerAnimation();
    initHeaderLinksCarousel();
    initHeroBgCarousel();
    // ScrollTrigger 相关动画在 DOM 就绪后注册
    initScrollReveal();
    initCountUp();
  });

  window.openMobileMenu = openMobileMenu;
  window.closeMobileMenu = closeMobileMenu;
  window.toggleFaq = toggleFaq;
})();
