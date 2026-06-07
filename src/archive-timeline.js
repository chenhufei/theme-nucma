/**
 * 归档时间树增强
 * 改进归档页展示方式
 */

class ArchiveTimeline {
  constructor() {
    this.archiveContainer = null;
    this.expandThreshold = 5;
    this.styleElement = null;
    this.init();
  }

  init() {
    this.archiveContainer = document.querySelector('.archive-section');
    if (!this.archiveContainer) return;

    this.setupYearCollapse();
    this.setupStatsWidget();
    this.addVisualEnhancements();
    this.setupScrollAnimation();
  }

  setupYearCollapse() {
    const years = this.archiveContainer.querySelectorAll('[data-year]');

    years.forEach(year => {
      const yearHeader = year.querySelector('.year-header');
      const monthList = year.querySelector('.month-list');
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'toggle-btn text-xs transition-all duration-300';
      toggleBtn.style.color = 'rgb(var(--color-accent))';
      toggleBtn.textContent = '收起';
      toggleBtn.setAttribute('aria-expanded', 'true');

      yearHeader.appendChild(toggleBtn);

      let isCollapsed = false;

      toggleBtn.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        monthList.style.display = isCollapsed ? 'none' : 'block';
        toggleBtn.textContent = isCollapsed ? '展开' : '收起';
        toggleBtn.style.color = isCollapsed ? 'rgb(148 163 184)' : 'rgb(var(--color-accent))';
        toggleBtn.setAttribute('aria-expanded', !isCollapsed);

        // 添加动画类
        if (!isCollapsed) {
          monthList.style.animation = 'fadeSlideIn 0.3s ease forwards';
        }
      });

      toggleBtn.addEventListener('mouseenter', () => {
        if (!isCollapsed) {
          toggleBtn.style.color = 'rgb(var(--color-accent-dark))';
          toggleBtn.style.transform = 'scale(1.05)';
        }
      });

      toggleBtn.addEventListener('mouseleave', () => {
        toggleBtn.style.color = isCollapsed ? 'rgb(148 163 184)' : 'rgb(var(--color-accent))';
        toggleBtn.style.transform = 'scale(1)';
      });

      const yearNum = parseInt(year.dataset.year);
      if (yearNum !== new Date().getFullYear()) {
        toggleBtn.click();
      }
    });
  }

  setupStatsWidget() {
    const articles = this.archiveContainer.querySelectorAll('[data-article]');
    const years = this.archiveContainer.querySelectorAll('[data-year]');

    const stats = {
      total: articles.length,
      years: years.length,
      thisYear: 0,
      thisMonth: 0
    };

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    articles.forEach(article => {
      const timeEl = article.querySelector('time');
      if (!timeEl) return;
      const date = timeEl.textContent;
      const [month] = date.split('-').map(Number);

      if (article.closest(`[data-year="${currentYear}"]`)) {
        stats.thisYear++;
        if (month === currentMonth) {
          stats.thisMonth++;
        }
      }
    });

    const statsWidget = document.createElement('div');
    statsWidget.className = 'archive-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 reveal-up';
    statsWidget.innerHTML = `
      <div class="stat-card rounded-xl p-4 text-center" style="background: linear-gradient(180deg, rgba(var(--color-card), 0.96), rgba(var(--color-card), 0.86)); border: 1px solid rgba(var(--color-text), 0.08);">
        <div class="stat-number text-2xl font-bold" style="color: rgb(var(--color-text));">${stats.total}</div>
        <div class="text-xs theme-text-muted mt-1">总文章数</div>
      </div>
      <div class="stat-card rounded-xl p-4 text-center" style="background: linear-gradient(180deg, rgba(var(--color-card), 0.94), rgba(var(--color-card), 0.84)); border: 1px solid rgba(var(--color-text), 0.08);">
        <div class="stat-number text-2xl font-bold" style="color: rgba(var(--color-text), 0.9);">${stats.years}</div>
        <div class="text-xs theme-text-muted mt-1">年份数</div>
      </div>
      <div class="stat-card rounded-xl p-4 text-center" style="background: linear-gradient(180deg, rgba(var(--color-card), 0.92), rgba(var(--color-card), 0.82)); border: 1px solid rgba(var(--color-text), 0.08);">
        <div class="stat-number text-2xl font-bold" style="color: rgba(var(--color-text), 0.82);">${stats.thisYear}</div>
        <div class="text-xs theme-text-muted mt-1">今年</div>
      </div>
      <div class="stat-card rounded-xl p-4 text-center" style="background: linear-gradient(180deg, rgba(var(--color-card), 0.9), rgba(var(--color-card), 0.8)); border: 1px solid rgba(var(--color-text), 0.08);">
        <div class="stat-number text-2xl font-bold" style="color: rgba(var(--color-text), 0.74);">${stats.thisMonth}</div>
        <div class="text-xs theme-text-muted mt-1">本月</div>
      </div>
    `;

    this.archiveContainer.insertBefore(statsWidget, this.archiveContainer.firstChild);

    // 统计数据动画
    setTimeout(() => {
      this.animateNumbers(statsWidget);
    }, 300);
  }

  animateNumbers(container) {
    const statNumbers = container.querySelectorAll('.stat-number');
    statNumbers.forEach(num => {
      const target = parseInt(num.textContent);
      let current = 0;
      const increment = Math.max(1, Math.floor(target / 20));
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          num.textContent = target;
          clearInterval(timer);
        } else {
          num.textContent = current;
        }
      }, 50);
    });
  }

  setupScrollAnimation() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    this.archiveContainer.querySelectorAll('.reveal-up').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

  addVisualEnhancements() {
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'archive-timeline-styles';
    this.styleElement.textContent = `
      [data-year] {
        transition: all 0.3s ease;
      }

      [data-article] {
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }

      [data-article]::before {
        content: '';
        position: absolute;
        left: -12px;
        top: 50%;
        width: 4px;
        height: 0;
        background: rgb(var(--color-accent));
        border-radius: 2px;
        transform: translateY(-50%);
        transition: height 0.3s ease;
      }

      [data-article]:hover::before {
        height: 80%;
      }

      [data-article]:hover {
        transform: translateX(6px);
        padding-left: 8px;
      }

      .toggle-btn {
        transition: all 0.2s ease;
      }

      .toggle-btn:hover {
        transform: scale(1.05);
      }

      .reveal-up {
        opacity: 0;
        transform: translateY(20px);
      }

      .reveal-up.visible {
        opacity: 1;
        transform: translateY(0);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      @keyframes fadeSlideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .stat-card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }

      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      }
    `;
    document.head.appendChild(this.styleElement);

    const articles = this.archiveContainer.querySelectorAll('[data-article]');
    articles.forEach((article, index) => {
      article.style.animationDelay = `${index * 50}ms`;
    });
  }

  destroy() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ArchiveTimeline().init());
} else {
  new ArchiveTimeline().init();
}
