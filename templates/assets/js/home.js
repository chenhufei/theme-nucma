(function () {
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseDatasetJson(value, fallback = []) {
    if (!value || value === 'null' || !String(value).trim()) {
      return fallback;
    }

    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function sanitizeUrl(rawUrl) {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl.replace('http://', 'https://');
    }
    if (rawUrl.startsWith('//')) {
      return `https:${rawUrl}`;
    }
    if (rawUrl.startsWith('/')) {
      return rawUrl;
    }
    return '';
  }

  function resolveFeaturedItems(items, featuredIds, extraKeys = []) {
    if (!featuredIds || !featuredIds.trim()) {
      return items;
    }

    const ids = featuredIds.split(',').map((id) => id.trim()).filter(Boolean);
    if (!ids.length) {
      return items;
    }

    const mapped = ids.map((id) => {
      const matched = items.find((item) => {
        const spec = item.spec || item;
        const candidates = [
          item.metadata?.name,
          item.metadata?.generateName,
          item.id,
          spec.id,
          spec.slug,
          spec.name,
          spec.displayName,
          ...extraKeys.map((key) => spec[key])
        ].filter(Boolean).map((value) => String(value));

        return candidates.includes(String(id));
      });

      if (matched) return matched;

      const numericId = Number(id);
      if (Number.isInteger(numericId) && numericId > 0) {
        return items[numericId - 1] || null;
      }

      return null;
    }).filter(Boolean);

    return mapped.length ? mapped : items;
  }

  function createFallbackMark(text, fallback = '#') {
    return (String(text || fallback).trim().slice(0, 1) || fallback).toUpperCase();
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initPostViewSwitcher() {
    const grid = document.getElementById('postsGrid');
    if (!grid) return;

    grid.hidden = false;
    grid.style.display = '';
    grid.classList.add('is-visible');
    grid.setAttribute('aria-hidden', 'false');
    localStorage.removeItem('postView');
  }

  function initHeroEnhancements() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const reducedMotion = prefersReducedMotion();
    const badge = hero.querySelector('.hero-badge');
    const visual = hero.querySelector('.hero-visual-wrapper');
    const logoStack = hero.querySelector('.hero-logo-stack');
    const pointerGlow = hero.querySelector('.hero-pointer-glow');
    const heroFog = hero.querySelector('.hero-fog-layer');
    const heroFogSecondary = hero.querySelector('.hero-fog-layer-secondary');
    if (!reducedMotion) {
      let ticking = false;
      const maxScroll = Math.max(window.innerHeight * 0.85, 420);

      const applyParallax = () => {
        const progress = Math.min(1, window.scrollY / maxScroll);

        if (badge) {
          badge.style.transform = `translate3d(0, ${progress * 8}px, 0)`;
        }

        if (visual) {
          visual.style.setProperty('--hero-scroll-y', `${(progress * -10).toFixed(2)}px`);
        }

        ticking = false;
      };

      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(applyParallax);
      }, { passive: true });

      applyParallax();

    }

    if (!pointerGlow || reducedMotion) {
      return;
    }

    function resetPointer() {
      hero.style.setProperty('--hero-pointer-opacity', '0');
      hero.style.setProperty('--hero-fog-x', '50%');
      hero.style.setProperty('--hero-fog-y', '28%');
      hero.style.setProperty('--hero-grid-x', '0px');
      hero.style.setProperty('--hero-grid-y', '0px');
      hero.style.setProperty('--hero-bg-tilt-x', '0deg');
      hero.style.setProperty('--hero-bg-tilt-y', '0deg');

      if (visual) {
        visual.style.removeProperty('--hero-visual-x');
        visual.style.removeProperty('--hero-visual-y');
      }

      if (logoStack) {
        logoStack.style.transform = '';
      }

      if (heroFog) {
        heroFog.style.opacity = '';
      }

      if (heroFogSecondary) {
        heroFogSecondary.style.opacity = '';
      }
    }

    let lastPointerMove = 0;
    hero.addEventListener('pointermove', (event) => {
      const now = Date.now();
      if (now - lastPointerMove < 48) return;
      lastPointerMove = now;

      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const offsetX = ((x - 50) / 50) * 5;
      const offsetY = ((y - 38) / 38) * 4;

      hero.style.setProperty('--hero-pointer-x', `${x.toFixed(2)}%`);
      hero.style.setProperty('--hero-pointer-y', `${y.toFixed(2)}%`);
      hero.style.setProperty('--hero-pointer-opacity', '1');
      hero.style.setProperty('--hero-fog-x', `${(48 + offsetX * 0.55).toFixed(2)}%`);
      hero.style.setProperty('--hero-fog-y', `${(28 + offsetY * 0.5).toFixed(2)}%`);
      hero.style.setProperty('--hero-grid-x', `${(offsetX * 1.8).toFixed(2)}px`);
      hero.style.setProperty('--hero-grid-y', `${(offsetY * 1.8).toFixed(2)}px`);
      hero.style.setProperty('--hero-bg-tilt-x', `${(-offsetY * 0.12).toFixed(2)}deg`);
      hero.style.setProperty('--hero-bg-tilt-y', `${(offsetX * 0.14).toFixed(2)}deg`);

      if (visual) {
        visual.style.setProperty('--hero-visual-x', `${(offsetX * 0.12).toFixed(2)}px`);
        visual.style.setProperty('--hero-visual-y', `${(offsetY * 0.14).toFixed(2)}px`);
      }

      if (logoStack) {
        logoStack.style.transform = `rotateX(${(-offsetY * 0.35).toFixed(2)}deg) rotateY(${(offsetX * 0.42).toFixed(2)}deg)`;
      }

      if (heroFog) {
        heroFog.style.opacity = `${Math.min(0.88, 0.72 + Math.abs(offsetX) * 0.012).toFixed(2)}`;
      }

      if (heroFogSecondary) {
        heroFogSecondary.style.opacity = `${Math.min(0.82, 0.62 + Math.abs(offsetY) * 0.015).toFixed(2)}`;
      }
    });

    hero.addEventListener('pointerleave', resetPointer);
    resetPointer();
  }

  function initHomeScrollChoreography() {
    const body = document.body;
    if (!body || !body.classList.contains('theme-page-home')) return;

    const reducedMotion = prefersReducedMotion()
      || window.themeConfig?.appearance?.enable_animations === false;
    const animatedSelectors = [
      '#hero .hero-badge',
      '#hero .hero-title',
      '#hero .hero-subtitle',
      '#hero .hero-motto',
      '#hero .command-panel-top',
      '#hero .command-panel-top > *',
      '#hero .command-signal-row',
      '#hero .command-signal-row > *',
      '#hero .command-panel-metrics > div',
      '#hero .command-panel-metrics > div > *',
      '#hero .hero-scroll-hint',
      '.nucma-section .theme-page-intro > *',
      '.nucma-section .home-section-heading > *',
      '.nucma-section .home-section-heading > * > *',
      '.nucma-section .manifesto-copy > *',
      '.nucma-section .manifesto-board > *',
      '.nucma-section .manifesto-principles > div',
      '.nucma-section .manifesto-principles > div > *',
      '.nucma-section .service-direction-card',
      '.nucma-section .service-direction-card > *',
      '.nucma-section .portal-feature-card',
      '.nucma-section .portal-feature-card > *',
      '.nucma-section .posts-view-switcher',
      '.nucma-section .posts-view-switcher > *',
      '.nucma-section .home-post-card',
      '.nucma-section .home-post-card-body > *',
      '.nucma-section .home-post-card-stats span',
      '.nucma-section .home-post-row',
      '.nucma-section .home-post-row-body > *',
      '.nucma-section .home-post-row-stats span',
      '.nucma-section .theme-outline-button',
      '.nucma-section .theme-outline-button > *',
      '.nucma-section .home-directory-shell',
      '.nucma-section .link-card',
      '.nucma-section .link-card > *',
      '.nucma-section .review-card',
      '.nucma-section .review-card > *',
      '.nucma-section .review-card > * > *',
      '.nucma-section .faq-item',
      '.nucma-section .faq-btn > *'
    ];
    const animatedSelector = animatedSelectors.join(',');
    const observedElements = new WeakSet();
    const revealDuration = 760;
    let observer = null;
    let mutationFrame = 0;
    const pendingRoots = new Set();

    function compareDocumentOrder(firstElement, secondElement) {
      if (firstElement === secondElement) return 0;
      return firstElement.compareDocumentPosition(secondElement) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    }

    function isEligible(element) {
      return element
        && element.nodeType === Node.ELEMENT_NODE
        && !observedElements.has(element)
        && !element.closest('[aria-hidden="true"]')
        && !element.closest('.hero-glow-bg, .command-grid-overlay, .hero-pointer-glow');
    }

    function collectTargets(scope) {
      const collected = new Set();
      const root = scope && scope.nodeType === Node.ELEMENT_NODE ? scope : document;

      if (root !== document && root.matches(animatedSelector) && isEligible(root)) {
        collected.add(root);
      }

      root.querySelectorAll(animatedSelector).forEach((element) => {
        if (isEligible(element)) {
          collected.add(element);
        }
      });

      return Array.from(collected).sort(compareDocumentOrder);
    }

    function resolveMotionVariant(element, index) {
      if (element.closest('#hero .command-hero-copy')) return 'left';
      if (element.closest('#hero .command-panel')) return 'right';
      if (element.matches('.service-direction-card, .portal-feature-card, .home-post-card, .home-post-row, .link-card, .review-card, .faq-item')) return 'scale';
      if (element.matches('.alliance-eyebrow, .nucma-section-subtitle, .service-direction-index, .portal-feature-tag, .home-post-card-meta, .home-post-row-meta')) return 'soft';
      if (element.closest('.portal-feature-card, .review-card') && index % 2 === 1) return 'right';
      return 'up';
    }

    function finishAnimation(element) {
      element.classList.remove('home-scroll-anim', 'is-visible');
      element.removeAttribute('data-home-motion');
      element.style.removeProperty('--home-scroll-delay');
    }

    function revealElement(element) {
      const delay = parseFloat(getComputedStyle(element).getPropertyValue('--home-scroll-delay')) || 0;
      element.classList.add('is-visible');
      window.setTimeout(() => finishAnimation(element), delay + revealDuration);
    }

    function decorateElements(elements) {
      const groupedElements = new Map();

      elements.forEach((element) => {
        const group = element.closest('#hero, .nucma-section') || body;
        const list = groupedElements.get(group) || [];
        list.push(element);
        groupedElements.set(group, list);
      });

      groupedElements.forEach((groupElements) => {
        groupElements.sort(compareDocumentOrder).forEach((element, index) => {
          if (!isEligible(element)) return;

          observedElements.add(element);
          if (reducedMotion || !observer) {
            element.classList.add('is-visible');
            return;
          }

          element.classList.add('home-scroll-anim');
          element.dataset.homeMotion = resolveMotionVariant(element, index);
          element.style.setProperty('--home-scroll-delay', `${Math.min(index * 38, 420)}ms`);
          observer.observe(element);
        });
      });
    }

    function decorateScope(scope = document) {
      decorateElements(collectTargets(scope));
    }

    if (reducedMotion || !('IntersectionObserver' in window)) {
      decorateScope(document);
      return;
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        revealElement(entry.target);
      });
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08
    });

    body.classList.add('home-scroll-motion-ready');
    decorateScope(document);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingRoots.add(node);
          }
        });
      });

      if (mutationFrame) return;
      mutationFrame = window.requestAnimationFrame(() => {
        pendingRoots.forEach((root) => decorateScope(root));
        pendingRoots.clear();
        mutationFrame = 0;
      });
    });

    mutationObserver.observe(document.querySelector('main') || body, {
      childList: true,
      subtree: true
    });

    window.nucmaHomeRefreshMotion = () => decorateScope(document);
  }

  function initStatsAnimation() {
    const statsSection = document.getElementById('stats');
    if (!statsSection) return;

    const stats = {
      postCount: Number(statsSection.dataset.postCount || 0),
      viewCount: Number(statsSection.dataset.viewCount || 0),
      categoryCount: Number(statsSection.dataset.categoryCount || 0),
      tagCount: Number(statsSection.dataset.tagCount || 0)
    };

    function setFinalValues() {
      const values = {
        postCount: stats.postCount,
        viewCount: stats.viewCount,
        categoryCount: stats.categoryCount,
        tagCount: stats.tagCount
      };

      Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = Number(value).toLocaleString();
        }
      });
    }

    if (prefersReducedMotion()) {
      setFinalValues();
      return;
    }

    function animateValue(id, start, end, duration) {
      const element = document.getElementById(id);
      if (!element) return;

      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value.toLocaleString();

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }

    function startAnimation() {
      animateValue('postCount', 0, stats.postCount, 900);
      animateValue('viewCount', 0, stats.viewCount, 820);
      animateValue('categoryCount', 0, stats.categoryCount, 760);
      animateValue('tagCount', 0, stats.tagCount, 760);
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          startAnimation();
          observer.disconnect();
        });
      }, { threshold: 0.2 });

      observer.observe(statsSection);
      return;
    }

    startAnimation();
  }

  function initLinksSection() {
    const section = document.getElementById('links');
    const container = document.getElementById('linksContainer');
    if (!section || !container) return;

    const featuredIds = section.dataset.featuredLinkIds || '';
    const apiEndpoints = [
      '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginLinks/links',
      '/apis/core.halo.run/v1alpha1/links',
      '/api/links'
    ];

    async function fetchLinks() {
      for (const endpoint of apiEndpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;

          const data = await response.json();
          return Array.isArray(data) ? data : (data.items || data.data || []);
        } catch {
          continue;
        }
      }

      return null;
    }

    fetchLinks().then((links) => {
      if (!links || !links.length) return;

      const displayLinks = resolveFeaturedItems(links, featuredIds);
      if (!displayLinks.length) return;

      displayLinks.forEach((link) => {
        const card = document.createElement('a');
        const spec = link.spec || link;
        const safeUrl = sanitizeUrl(spec.url || '');
        const safeLogo = sanitizeUrl(spec.logo || '');
        const displayName = spec.displayName || spec.name || '未命名链接';
        const description = spec.description || '';
        const fallbackMark = createFallbackMark(displayName, '#');

        card.href = safeUrl || '#';
        if (safeUrl) {
          card.target = '_blank';
          card.rel = 'noopener noreferrer';
        }

        card.className = 'link-card link-card-compact home-directory-card group';
        card.innerHTML = `
          <div class="link-card-logo">
            ${safeLogo ? `<img src="${safeLogo}" alt="${esc(displayName)}" class="w-full h-full object-cover" />` : `<span class="flex h-full w-full items-center justify-center text-sm font-semibold">${esc(fallbackMark)}</span>`}
          </div>
          <div class="link-card-body">
            <span class="link-card-name accent-text-hover transition-colors line-clamp-1">${esc(displayName)}</span>
            ${description ? `<span class="link-card-desc line-clamp-1">${esc(description)}</span>` : ''}
          </div>
          <svg class="link-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        `;

        container.appendChild(card);
      });

      section.classList.add('is-visible');
    }).catch(() => {});
  }

  function initMembersSection() {
    const section = document.getElementById('members');
    const container = document.getElementById('membersContainer');
    if (!section || !container) return;

    const staticMembers = parseDatasetJson(section.dataset.staticMembers, []);
    const featuredIds = section.dataset.featuredMemberIds || '';
    const apiEndpoints = [
      '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers/members',
      '/apis/anonymous.member.plugin.halo.run/v1alpha1/members',
      '/apis/member.plugin.halo.run/v1alpha1/members'
    ];

    async function fetchMembers() {
      if (staticMembers.length > 0) {
        return staticMembers.map((member) => ({ spec: member }));
      }

      for (const endpoint of apiEndpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
            continue;
          }

          const data = await response.json();
          let members = [];

          if (Array.isArray(data?.items)) {
            if (data.items.length > 0 && Array.isArray(data.items[0]?.members)) {
              data.items.forEach((group) => {
                if (Array.isArray(group.members)) {
                  members.push(...group.members);
                }
              });
            } else {
              members = data.items;
            }
          } else if (Array.isArray(data)) {
            members = data;
          }

          if (members.length > 0) {
            return members;
          }
        } catch {
          continue;
        }
      }

      return null;
    }

    function createMemberCard(member) {
      const spec = member.spec || member;
      const card = document.createElement('a');
      const safeUrl = sanitizeUrl(spec.qqFriendLink || spec.url || '');
      const safeAvatar = sanitizeUrl(spec.avatar || '');
      const displayName = spec.displayName || spec.name || '未命名成员';
      const description = spec.bio || spec.school || '';
      const fallbackMark = createFallbackMark(displayName, 'M');

      card.href = safeUrl || '#';
      if (safeUrl) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }

      card.className = 'link-card link-card-compact home-directory-card member-card member-card-compact group';
      card.innerHTML = `
        <div class="link-card-logo">
          ${safeAvatar ? `<img src="${safeAvatar}" alt="${esc(displayName)}" class="w-full h-full object-cover" />` : `<span class="flex h-full w-full items-center justify-center text-sm font-semibold">${esc(fallbackMark)}</span>`}
        </div>
        <div class="link-card-body">
          <span class="link-card-name accent-text-hover transition-colors line-clamp-1">${esc(displayName)}</span>
          ${description ? `<span class="link-card-desc line-clamp-1">${esc(description)}</span>` : ''}
        </div>
        <svg class="link-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      `;

      return card;
    }

    fetchMembers().then((members) => {
      if (!members || !members.length) return;

      const displayMembers = resolveFeaturedItems(members, featuredIds, ['username']);
      displayMembers.forEach((member) => {
        container.appendChild(createMemberCard(member));
      });

      section.classList.add('is-visible');
    }).catch(() => {});
  }

  function initReviewsSection() {
    const track = document.querySelector('.reviews-track');
    if (!track || track.dataset.carouselReady === 'true') return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mask = track.closest('.reviews-mask') || track.parentElement;
    const sourceCards = Array.from(track.querySelectorAll('.review-card'))
      .filter((card) => card.dataset.reviewClone !== 'true');
    if (!sourceCards.length) {
      track.style.visibility = 'visible';
      return;
    }

    let cycleWidth = 0;
    let offsetX = 0;
    let lastFrame = 0;
    let animationFrame = 0;
    let paused = false;

    function normalizeReviewCard(card, isClone = false) {
      if (isClone) {
        card.dataset.reviewClone = 'true';
        card.setAttribute('aria-hidden', 'true');
      }

      [card, ...card.querySelectorAll('*')].forEach((element) => {
        element.classList.remove('home-scroll-anim');
        element.classList.add('is-visible');
        element.removeAttribute('data-home-motion');
        element.style.removeProperty('--home-scroll-delay');
        element.style.opacity = '1';
        element.style.transform = 'none';
        element.style.filter = 'none';
        if (isClone) {
          element.style.transition = 'none';
        } else {
          element.style.removeProperty('transition');
        }
      });
    }

    function removeClones() {
      track.querySelectorAll('[data-review-clone="true"]').forEach((clone) => clone.remove());
    }

    function resolveSpeed() {
      const width = window.innerWidth || document.documentElement.clientWidth || 1024;
      if (width < 640) return 20;
      if (width < 1024) return 28;
      return 36;
    }

    function appendCloneSet() {
      sourceCards.forEach((card) => {
        const clone = card.cloneNode(true);
        normalizeReviewCard(clone, true);
        track.appendChild(clone);
      });
    }

    function measureCycleWidth() {
      const firstSource = sourceCards[0];
      const lastSource = sourceCards[sourceCards.length - 1];
      if (!firstSource || !lastSource) return 0;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20;
      const firstRect = firstSource.getBoundingClientRect();
      const lastRect = lastSource.getBoundingClientRect();
      return Math.max(1, lastRect.right - firstRect.left + gap);
    }

    function rebuildTrack() {
      removeClones();
      track.style.transform = 'translate3d(0, 0, 0)';

      if (!sourceCards.some((card) => card.getBoundingClientRect().width > 0)) return false;

      cycleWidth = measureCycleWidth();
      if (!cycleWidth) return false;

      const viewportWidth = Math.max(
        mask?.getBoundingClientRect().width || 0,
        window.innerWidth || document.documentElement.clientWidth || 1024
      );
      const minWidth = Math.max(viewportWidth + cycleWidth * 2, cycleWidth * 3);

      while (track.scrollWidth < minWidth) {
        appendCloneSet();
      }

      return true;
    }

    function applyStaticState() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      track.style.visibility = 'visible';
      track.style.transform = 'translate3d(0, 0, 0)';
    }

    function tick(timestamp) {
      if (reducedMotionQuery.matches) {
        applyStaticState();
        return;
      }

      if (!lastFrame) lastFrame = timestamp;
      if (paused) {
        lastFrame = timestamp;
        track.style.visibility = 'visible';
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      if (!cycleWidth && !rebuildTrack()) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(64, timestamp - lastFrame);
      lastFrame = timestamp;
      offsetX -= (resolveSpeed() * delta) / 1000;

      while (offsetX <= -cycleWidth) {
        offsetX += cycleWidth;
      }

      track.style.visibility = 'visible';
      track.style.transform = `translate3d(${offsetX.toFixed(3)}px, 0, 0)`;
      animationFrame = window.requestAnimationFrame(tick);
    }

    sourceCards.forEach((card) => normalizeReviewCard(card));

    const pauseCarousel = () => {
      paused = true;
      track.classList.add('is-paused');
    };

    const resumeCarousel = () => {
      paused = false;
      lastFrame = 0;
      track.classList.remove('is-paused');
    };

    track.addEventListener('pointerover', (event) => {
      if (event.target.closest('.review-card')) pauseCarousel();
    }, { passive: true });
    track.addEventListener('pointerout', (event) => {
      if (!event.relatedTarget || !track.contains(event.relatedTarget)) resumeCarousel();
    }, { passive: true });
    track.addEventListener('focusin', (event) => {
      if (event.target.closest('.review-card')) pauseCarousel();
    });
    track.addEventListener('focusout', () => {
      window.requestAnimationFrame(() => {
        if (!track.contains(document.activeElement)) resumeCarousel();
      });
    });
    track.addEventListener('wheel', () => {}, { passive: true });

    function start() {
      window.cancelAnimationFrame(animationFrame);
      track.dataset.carouselReady = 'true';
      lastFrame = 0;
      offsetX = 0;

      if (reducedMotionQuery.matches || !rebuildTrack()) {
        applyStaticState();
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(start, 160);
    }, { passive: true });

    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', start);
    } else if (typeof reducedMotionQuery.addListener === 'function') {
      reducedMotionQuery.addListener(start);
    }

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(start).catch(start);
    }

    start();
  }

  function initFaqAccordion() {
    const buttons = Array.from(document.querySelectorAll('.faq-btn'));
    if (!buttons.length) return;

    buttons.forEach((button) => {
      if (button.dataset.faqReady === 'true') return;
      button.dataset.faqReady = 'true';

      const bodyId = button.getAttribute('aria-controls');
      const body = bodyId ? document.getElementById(bodyId) : button.nextElementSibling;
      if (!body) return;
      const item = button.closest('.faq-item');

      const setBodyHeight = () => {
        body.style.setProperty('--faq-body-height', `${body.scrollHeight}px`);
      };

      const openBody = (instant = false) => {
        button.setAttribute('aria-expanded', 'true');
        item?.classList.add('active');
        body.style.setProperty('--faq-body-visibility', 'visible');
        body.style.setProperty('--faq-body-opacity', '1');
        body.hidden = false;
        setBodyHeight();

        if (instant || prefersReducedMotion()) {
          return;
        }

        requestAnimationFrame(setBodyHeight);
      };

      const closeBody = (instant = false) => {
        button.setAttribute('aria-expanded', 'false');
        item?.classList.remove('active');
        body.style.setProperty('--faq-body-opacity', '0');

        if (instant || prefersReducedMotion()) {
          body.style.setProperty('--faq-body-height', '0px');
          body.hidden = true;
          return;
        }

        requestAnimationFrame(() => {
          body.style.setProperty('--faq-body-height', '0px');
        });
        body.addEventListener('transitionend', () => {
          if (button.getAttribute('aria-expanded') === 'false') {
            body.style.setProperty('--faq-body-visibility', 'hidden');
            body.hidden = true;
          }
        }, { once: true });
      };

      if (button.getAttribute('aria-expanded') === 'true') {
        openBody(true);
      } else {
        closeBody(true);
      }

      button.addEventListener('click', () => {
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        if (isOpen) closeBody();
        else openBody();
      });
    });
  }

  ready(() => {
    initPostViewSwitcher();
    initHeroEnhancements();
    initHomeScrollChoreography();
    initStatsAnimation();
    initLinksSection();
    initMembersSection();
    initReviewsSection();
    initFaqAccordion();
  });
})();
