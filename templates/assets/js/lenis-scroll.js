/**
 * Lenis 平滑滚动
 * 实现流畅的惯性滚动效果
 */

class SmoothScroll {
  constructor() {
    this.lenis = null;
    this.isMobile = window.innerWidth < 768;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  init() {
    // 移动端或偏好减弱动画时不启用平滑滚动
    if (this.isMobile || this.prefersReducedMotion) {
      return;
    }

    // 动态导入 Lenis
    this.loadLenis().then(() => {
      if (typeof Lenis !== 'undefined') {
        this.lenis = new Lenis({
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          direction: 'vertical',
          gestureDirection: 'vertical',
          smooth: true,
          smoothTouch: false,
          touchMultiplier: 2,
        });

        this.raf();
        this.setupEventListeners();
      }
    }).catch(err => {
      console.warn('Lenis 加载失败,使用原生滚动:', err);
    });
  }

  // 动态加载 Lenis 库
  async loadLenis() {
    return new Promise((resolve, reject) => {
      if (typeof Lenis !== 'undefined') {
        resolve();
        return;
      }

      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
        'https://unpkg.com/@studio-freight/lenis@1.0.42/dist/lenis.min.js'
      ];
      let current = 0;
      let resolved = false;
      
      function tryLoad() {
        if (current >= cdnUrls.length) {
          reject(new Error('All Lenis CDNs failed'));
          return;
        }
        
        const script = document.createElement('script');
        script.src = cdnUrls[current];
        script.onload = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        script.addEventListener('error', () => {
          current++;
          tryLoad();
        }, { once: true });
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Lenis CDN timeout: ' + cdnUrls[current]));
          }
        }, 5000);
        document.head.appendChild(script);
      }
      
      tryLoad();
    });
  }

  raf(time) {
    if (this.lenis) {
      this.lenis.raf(time);
    }
    requestAnimationFrame(this.raf.bind(this));
  }

  setupEventListeners() {
    // 页面可见性变化时暂停/恢复
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.lenis?.stop();
      } else {
        this.lenis?.start();
      }
    });

    // 表单获得焦点时暂停,避免滚动干扰输入
    const focusableElements = document.querySelectorAll('input, textarea, select');
    focusableElements.forEach(el => {
      el.addEventListener('focus', () => this.lenis?.stop());
      el.addEventListener('blur', () => this.lenis?.start());
    });
  }

  // 滚动到指定元素
  scrollTo(target, options = {}) {
    if (this.lenis) {
      if (typeof target === 'string') {
        this.lenis.scrollTo(target, options);
      } else if (target instanceof HTMLElement) {
        this.lenis.scrollTo(target, options);
      } else {
        this.lenis.scrollTo(target, options);
      }
    } else {
      // 回退到原生滚动
      if (typeof target === 'string') {
        const el = document.querySelector(target);
        if (el) el.scrollIntoView({ behavior: 'smooth', ...options });
      } else if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', ...options });
      }
    }
  }

  // 销毁平滑滚动
  destroy() {
    if (this.lenis) {
      this.lenis.destroy();
      this.lenis = null;
    }
  }
}

// 导出供全局使用
window.SmoothScroll = SmoothScroll;

// 自动初始化
(function autoInit() {
  const smoothScrollEnabled = window.themeConfig?.appearance?.enable_smooth_scroll === true;
  if (!smoothScrollEnabled) return;

  function init() {
    new SmoothScroll().init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
