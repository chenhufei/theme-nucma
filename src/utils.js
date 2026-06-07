/**
 * 工具函数库
 * 提供通用的工具函数和辅助方法
 */

/**
 * 日志工具
 */
const Logger = {
  log: (...args) => {
    if (window.DEBUG) console.log(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
  warn: (...args) => {
    if (window.DEBUG) console.warn(...args);
  }
};

/**
 * 尝试多个 API 端点，返回第一个成功的响应
 * @param {string[]} endpoints - API 端点数组
 * @param {RequestInit} options - fetch 选项
 * @returns {Promise<any>} - 成功的响应数据，失败返回 null
 */
async function tryFetchEndpoints(endpoints, options = {}) {
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, options);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // 继续尝试下一个端点
      continue;
    }
  }
  return null;
}

/**
 * 模糊匹配函数
 * @param {string} text - 要搜索的文本
 * @param {string} query - 查询关键词
 * @returns {boolean} - 是否匹配
 */
function fuzzyMatch(text, query) {
  if (!text) return false;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  // 完全匹配
  if (t.includes(q)) return true;

  // 分词匹配（空格分隔）
  return q.split(/\s+/).every(w => t.includes(w));
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} - 防抖后的函数
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} - 节流后的函数
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * HTML 转义函数
 * @param {string} s - 要转义的字符串
 * @returns {string} - 转义后的字符串
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * FAQ 手风琴切换
 * 处理展开/折叠、无障碍属性、关闭兄弟项
 * @param {HTMLElement} btn - 点击的按钮元素
 */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  if (!item) return;

  const list = item.closest('.faq-list');
  const isOpening = !item.classList.contains('active');

  // 手风琴模式：关闭同列表其他已打开项
  if (isOpening && list) {
    list.querySelectorAll('.faq-item.active').forEach(sibling => {
      if (sibling === item) return;
      sibling.classList.remove('active');
      const sibBtn = sibling.querySelector('.faq-btn');
      if (sibBtn) sibBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // 切换当前项
  item.classList.toggle('active');
  btn.setAttribute('aria-expanded', item.classList.contains('active'));
}

/**
 * 平滑滚动到指定元素
 * @param {HTMLElement} element - 目标元素
 * @param {number} offset - 偏移量
 * @param {number} duration - 动画持续时间（毫秒）
 */
function smoothScrollTo(element, offset = 0, duration = 800) {
  const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }

  function ease(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }

  requestAnimationFrame(animation);
}

/**
 * 滚动动画效果
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal, .reveal-up, .reveal-down, .reveal-left, .reveal-right, .reveal-scale, .reveal-flip, .reveal-rotate');

  function checkReveal() {
    const windowHeight = window.innerHeight;
    const revealPoint = 150;

    revealElements.forEach(element => {
      const revealTop = element.getBoundingClientRect().top;
      if (revealTop < windowHeight - revealPoint) {
        element.classList.add('visible');
      }
    });
  }

  // 初始检查
  checkReveal();
  
  // 滚动时检查
  window.addEventListener('scroll', throttle(checkReveal, 100));
}

/**
 * 交错动画效果
 */
function initStaggerAnimation() {
  const staggerGroups = document.querySelectorAll('.stagger-group');

  staggerGroups.forEach(group => {
    const items = group.querySelectorAll('.stagger-item');
    let delay = 0;
    
    items.forEach((item, index) => {
      setTimeout(() => {
        item.classList.add('visible');
      }, delay);
      delay += 100;
    });
  });
}

/**
 * 初始化时间线动画
 */
function initTimelineAnimation() {
  const timelineItems = document.querySelectorAll('.timeline-item');
  
  function checkTimeline() {
    const windowHeight = window.innerHeight;
    
    timelineItems.forEach(item => {
      const itemTop = item.getBoundingClientRect().top;
      if (itemTop < windowHeight - 100) {
        item.classList.add('visible');
      }
    });
  }
  
  checkTimeline();
  window.addEventListener('scroll', throttle(checkTimeline, 100));
}

/**
 * 初始化特性卡片动画
 */
function initFeatureCardAnimation() {
  const featureCards = document.querySelectorAll('.feature-card');
  
  function checkFeatureCards() {
    const windowHeight = window.innerHeight;
    
    featureCards.forEach(card => {
      const cardTop = card.getBoundingClientRect().top;
      if (cardTop < windowHeight - 100) {
        card.classList.add('visible');
      }
    });
  }
  
  checkFeatureCards();
  window.addEventListener('scroll', throttle(checkFeatureCards, 100));
}

/**
 * 初始化打字机效果
 */
function initTypewriterEffect() {
  const typewriterElements = document.querySelectorAll('.typewriter');
  
  typewriterElements.forEach(element => {
    const text = element.textContent;
    element.textContent = '';
    let index = 0;
    
    function type() {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        setTimeout(type, 100);
      }
    }
    
    type();
  });
}

/**
 * 初始化阅读模式
 */
function initReadingMode() {
  const readingModeBtn = document.getElementById('readingModeBtn');
  const body = document.body;
  
  if (!readingModeBtn) return;
  
  readingModeBtn.addEventListener('click', () => {
    body.classList.toggle('reading-mode');
    if (body.classList.contains('reading-mode')) {
      readingModeBtn.textContent = '退出阅读模式';
    } else {
      readingModeBtn.textContent = '阅读模式';
    }
  });
}

/**
 * 初始化评论功能
 */
function initComments() {
  const commentForm = document.querySelector('.comment-form');
  if (!commentForm) return;
  
  commentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // 这里可以添加评论提交逻辑
    const formData = new FormData(commentForm);
    // 模拟提交
    const submitBtn = commentForm.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = '提交中...';
    submitBtn.disabled = true;
    
    setTimeout(() => {
      submitBtn.textContent = '提交成功';
      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        commentForm.reset();
      }, 2000);
    }, 1500);
  });
}

// 导出到全局
window.Logger = Logger;
window.tryFetchEndpoints = tryFetchEndpoints;
window.fuzzyMatch = fuzzyMatch;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.throttle = throttle;
window.toggleFaq = toggleFaq;
window.smoothScrollTo = smoothScrollTo;
window.initScrollReveal = initScrollReveal;
window.initStaggerAnimation = initStaggerAnimation;
window.initTimelineAnimation = initTimelineAnimation;
window.initFeatureCardAnimation = initFeatureCardAnimation;
window.initTypewriterEffect = initTypewriterEffect;
window.initReadingMode = initReadingMode;
window.initComments = initComments;
