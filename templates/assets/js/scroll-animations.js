/**
 * 滚动触发动画系统
 * 仿 AOS 效果，但更轻量、更可定制
 */

class ScrollAnimations {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || '0px 0px -24px 0px',
      threshold: options.threshold || 0.05,
      delay: options.delay || 0,
      duration: options.duration || 360,
      easing: options.easing || 'cubic-bezier(0.22, 1, 0.36, 1)',
      once: options.once !== false, // 默认只触发一次
      ...options
    };

    this.observer = null;
    this.elements = [];
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || window.themeConfig?.appearance?.enable_animations === false;
  }

  init() {
    // 偏好减弱动画时禁用
    if (this.isReducedMotion) {
      this.showAll();
      return;
    }

    this.elements = this.getAnimatedElements();

    if (!this.elements.length) {
      return;
    }

    this.createObserver();
    this.elements.forEach(el => this.observer.observe(el));
  }

  // 获取所有需要动画的元素
  getAnimatedElements() {
    const selectors = [
      '.reveal',
      '.reveal-up',
      '.reveal-down',
      '.reveal-left',
      '.reveal-right',
      '.reveal-fade',
      '.reveal-scale',
      '.reveal-flip',
      '.reveal-rotate',
      '.reveal-zoom',
      '.reveal-blur',
      '.reveal-swing',
      '.reveal-bounce',
      '.stagger-item',
      '.timeline-item',
      '.feature-card',
      '.link-card',
      '.member-card',
      '.home-post-card',
      '.portal-feature-card',
      '.service-direction-card',
      '.faq-item',
      '.post-sidebar-card'
    ];

    const elements = [];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        elements.push(el);
      });
    });

    return elements;
  }

  // 创建 IntersectionObserver
  createObserver() {
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersect(entries),
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      }
    );
  }

  // 处理元素进入视口
  handleIntersect(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        this.animateElement(entry.target);

        if (this.options.once) {
          this.observer.unobserve(entry.target);
        }
      } else if (!this.options.once) {
        // 重置元素状态（可选）
        this.resetElement(entry.target);
      }
    });
  }

  // 执行动画
  animateElement(el) {
    const animationType = this.getAnimationType(el);
    const delay = this.getDelay(el);
    const duration = this.getDuration(el);
    const staggerIndex = this.getStaggerIndex(el);
    const totalDelay = delay + staggerIndex * 40;

    const easing = el.dataset.aosEasing || 'cubic-bezier(0.22, 1, 0.36, 1)';

    el.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}, filter ${duration}ms ${easing}`;
    el.style.transitionDelay = `${totalDelay}ms`;

    el.classList.add('visible', 'animated');

    switch (animationType) {
      case 'up':
        el.style.transform = 'translate3d(0, 0, 0)';
        el.style.opacity = '1';
        break;
      case 'down':
        el.style.transform = 'translate3d(0, 0, 0)';
        el.style.opacity = '1';
        break;
      case 'left':
        el.style.transform = 'translate3d(0, 0, 0)';
        el.style.opacity = '1';
        break;
      case 'right':
        el.style.transform = 'translate3d(0, 0, 0)';
        el.style.opacity = '1';
        break;
      case 'scale':
      case 'zoom':
        el.style.transform = 'scale3d(1, 1, 1)';
        el.style.opacity = '1';
        break;
      case 'flip':
        el.style.transform = 'perspective(400px) rotateY(0deg)';
        el.style.opacity = '1';
        break;
      case 'rotate':
        el.style.transform = 'rotate(0deg)';
        el.style.opacity = '1';
        break;
      case 'blur':
        el.style.filter = 'blur(0px)';
        el.style.opacity = '1';
        break;
      case 'swing':
      case 'bounce':
      default:
        el.style.transform = 'translate3d(0, 0, 0)';
        el.style.opacity = '1';
    }
  }

  // 重置元素状态
  resetElement(el) {
    el.classList.remove('visible', 'animated');
    el.style.transition = '';
    el.style.transitionDelay = '';
    el.style.transform = '';
    el.style.filter = '';
    el.style.opacity = '';

    const animationType = this.getAnimationType(el);

    switch (animationType) {
      case 'up':
        el.style.transform = 'translate3d(0, 14px, 0)';
        el.style.opacity = '0';
        break;
      case 'down':
        el.style.transform = 'translate3d(0, -14px, 0)';
        el.style.opacity = '0';
        break;
      case 'left':
        el.style.transform = 'translate3d(-14px, 0, 0)';
        el.style.opacity = '0';
        break;
      case 'right':
        el.style.transform = 'translate3d(14px, 0, 0)';
        el.style.opacity = '0';
        break;
      case 'scale':
      case 'zoom':
        el.style.transform = 'scale3d(0.985, 0.985, 1)';
        el.style.opacity = '0';
        break;
      case 'flip':
        el.style.transform = 'perspective(400px) rotateY(-14deg)';
        el.style.opacity = '0';
        break;
      case 'rotate':
        el.style.transform = 'rotate(-4deg)';
        el.style.opacity = '0';
        break;
      case 'blur':
        el.style.filter = 'blur(4px)';
        el.style.opacity = '0';
        break;
      case 'swing':
        el.style.transform = 'perspective(400px) rotateY(-8deg) rotateX(6deg)';
        el.style.opacity = '0';
        break;
      case 'bounce':
        el.style.transform = 'translate3d(0, -10px, 0)';
        el.style.opacity = '0';
        break;
      default:
        el.style.opacity = '0';
    }
  }

  // 获取动画类型
  getAnimationType(el) {
    if (el.classList.contains('reveal-up')) return 'up';
    if (el.classList.contains('reveal-down')) return 'down';
    if (el.classList.contains('reveal-left')) return 'left';
    if (el.classList.contains('reveal-right')) return 'right';
    if (el.classList.contains('reveal-scale')) return 'scale';
    if (el.classList.contains('reveal-flip')) return 'flip';
    if (el.classList.contains('reveal-rotate')) return 'rotate';
    if (el.classList.contains('reveal-zoom')) return 'zoom';
    if (el.classList.contains('reveal-blur')) return 'blur';
    if (el.classList.contains('reveal-swing')) return 'swing';
    if (el.classList.contains('reveal-bounce')) return 'bounce';
    if (el.classList.contains('stagger-item')) return 'up';
    if (el.classList.contains('timeline-item')) return 'left';
    if (el.classList.contains('feature-card')) return 'up';
    if (el.matches('.link-card, .member-card, .home-post-card, .portal-feature-card, .service-direction-card, .faq-item, .post-sidebar-card')) return 'scale';
    return 'fade'; // 默认
  }

  // 获取延迟
  getDelay(el) {
    const delayAttr = el.getAttribute('data-aos-delay');
    return delayAttr ? parseInt(delayAttr) : this.options.delay;
  }

  // 获取持续时间
  getDuration(el) {
    const durationAttr = el.getAttribute('data-aos-duration');
    return durationAttr ? parseInt(durationAttr) : this.options.duration;
  }

  // 获取交错索引（用于组内元素依次出现）
  getStaggerIndex(el) {
    const parent = el.closest('.stagger-group, .stagger');
    if (!parent) return 0;

    const siblings = parent.querySelectorAll('.stagger-item');
    return Array.from(siblings).indexOf(el);
  }

  // 显示所有元素（禁用动画时）
  showAll() {
    this.elements = this.getAnimatedElements();
    this.elements.forEach(el => {
      el.classList.add('visible');
      el.style.opacity = '1';
      el.style.transform = '';
    });
  }

  // 销毁观察器
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.elements = [];
  }
}

// 导出供全局使用
window.ScrollAnimations = ScrollAnimations;

// 自动初始化
(function autoInit() {
  function init() {
    new ScrollAnimations().init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
