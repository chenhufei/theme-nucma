/**
 * 移动端优化增强
 * 触摸手势、滑动、触觉反馈等现代交互
 */

class MobileOptimizer {
  constructor() {
    this.isMobile = window.innerWidth < 768;
    this.touchStartY = 0;
    this.touchActive = false;
    this.styleElement = null;
    this.modalContentSelector = '.modal-content, .nucma-modal-panel, .auth-shell';
  }

  init() {
    if (!this.isMobile) return;

    // 禁用移动端Header滚动隐藏，避免与scripts.html中的液态毛玻璃效果冲突
    // this.setupHeaderScroll();
    this.setupTouchGestures();
    this.setupTouchRipple();
    this.setupSwipeNavigation();
    this.setupMobileModals();
    this.addMobileStyles();
  }

  setupTouchGestures() {
    this.setupDoubleTapZoom();
    this.setupSwipeDismiss();
    this.setupLongPress();
  }

  setupDoubleTapZoom() {
    document.querySelectorAll('.prose img, .post-content img').forEach(img => {
      let lastTap = 0;
      img.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < 350 && now - lastTap > 0) {
          this.openImagePreview(img.currentSrc || img.src);
          e.preventDefault();
        }
        lastTap = now;
      });
    });
  }

  setupSwipeDismiss() {
    document.addEventListener('touchstart', (e) => {
      this.touchStartY = e.touches[0].clientY;
      this.touchActive = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this.touchActive) return;
      const diff = e.touches[0].clientY - this.touchStartY;

      // 仅在顶部向下滑动时触发提示
      if (window.scrollY <= 5 && diff > 60) {
        document.body.style.setProperty('--pull-distance', `${Math.min(diff, 120)}px`);
        document.body.classList.add('pull-indicator-active');
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      this.touchActive = false;
      document.body.classList.remove('pull-indicator-active');
      document.body.style.removeProperty('--pull-distance');
    }, { passive: true });
  }

  setupLongPress() {
    document.querySelectorAll('.prose img, .post-content img, .card-image img').forEach(img => {
      let timer = null;

      img.addEventListener('touchstart', () => {
        timer = setTimeout(() => {
          const url = img.currentSrc || img.src;
          if (navigator.share && url.startsWith('http')) {
            navigator.share({ url }).catch(() => {});
          }
        }, 600);
      }, { passive: true });

      img.addEventListener('touchend', () => clearTimeout(timer));
      img.addEventListener('touchmove', () => clearTimeout(timer));
    });
  }

  setupTouchRipple() {
    document.addEventListener('pointerdown', (e) => {
      const target = e.target.closest('button, .btn, a.btn-primary, a.btn-accent, .nucma-action-chip');
      if (!target) return;

      const ripple = document.createElement('span');
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.className = 'touch-ripple';
      ripple.style.cssText = `
        width:${size}px;height:${size}px;
        left:${x}px;top:${y}px;
      `;
      target.style.position = target.style.position || 'relative';
      target.style.overflow = 'hidden';
      target.appendChild(ripple);

      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  setupSwipeNavigation() {
    let startX = 0;
    let startY = 0;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;

      // 仅横向滑动且距离够大时触发
      if (Math.abs(diffX) < 80 || Math.abs(diffX) < Math.abs(diffY) * 1.5) return;

      const isForward = diffX < 0;
      // 尝试查找前后文章链接
      const nextLink = isForward
        ? document.querySelector('[rel="next"], .post-nav-next a')
        : document.querySelector('[rel="prev"], .post-nav-prev a');

      if (nextLink && nextLink.href) {
        window.location.href = nextLink.href;
      }
    }, { passive: true });
  }

  setupMobileModals() {
    document.querySelectorAll('.fixed.inset-0').forEach(modal => {
      if (modal.classList.contains('mobile-modal')) return;
      modal.classList.add('mobile-modal');
      const content = modal.querySelector(this.modalContentSelector);
      if (content) {
        content.classList.add('mobile-modal-content');
      }
    });
  }

  addMobileStyles() {
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'mobile-optimizations';
    this.styleElement.textContent = `
      .touch-ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-expand 0.6s ease-out forwards;
        pointer-events: none;
      }
      @keyframes ripple-expand {
        to { transform: scale(1); opacity: 0; }
      }
      .mobile-modal {
        align-items: flex-end;
      }
      .mobile-modal-content {
        border-radius: 20px 20px 0 0;
        max-height: 90vh;
        max-width: 100%;
        margin: auto auto 0;
        animation: modalSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes modalSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .pull-indicator-active::before {
        content: '';
        position: fixed;
        top: var(--pull-distance, 0);
        left: 50%;
        transform: translateX(-50%);
        width: 28px;
        height: 28px;
        border: 2.5px solid rgb(var(--color-accent));
        border-top-color: transparent;
        border-radius: 50%;
        animation: pull-spin 0.8s linear infinite;
        z-index: 9999;
        pointer-events: none;
      }
      @keyframes pull-spin {
        to { transform: translateX(-50%) rotate(360deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .touch-ripple { animation: none; }
        .mobile-modal-content { animation: none; }
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  openImagePreview(src) {
    const safeSrc = src.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4';
    overlay.innerHTML = `
      <img src="${safeSrc}" class="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
           style="touch-action: pinch-zoom;">
      <button class="absolute top-4 right-4 text-white/80 hover:text-white p-3 rounded-full transition-colors"
              aria-label="关闭">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    const cleanup = () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    };

    const onKey = (e) => { if (e.key === 'Escape') cleanup(); };

    overlay.querySelector('button').addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      const img = overlay.querySelector('img');
      img.style.transform = 'scale(0.92)';
      img.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
      requestAnimationFrame(() => { img.style.transform = 'scale(1)'; });
    });

    document.addEventListener('keydown', onKey);
  }

  destroy() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}

// 全局实例管理
let mobileOptimizer = null;

function initMobileOptimizer() {
  if (window.innerWidth < 768 && !mobileOptimizer) {
    mobileOptimizer = new MobileOptimizer();
    mobileOptimizer.init();
  }
}

function destroyMobileOptimizer() {
  if (mobileOptimizer) {
    mobileOptimizer.destroy();
    mobileOptimizer = null;
  }
}

// TODO: visibilitychange handler removed — mobileOptimizer.observer was never defined.
// Re-implement if a MutationObserver/IntersectionObserver is added to MobileOptimizer.

// 窗口大小变化
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth < 768 && !mobileOptimizer) {
      initMobileOptimizer();
    } else if (window.innerWidth >= 768 && mobileOptimizer) {
      destroyMobileOptimizer();
    }
  }, 250);
});

initMobileOptimizer();
