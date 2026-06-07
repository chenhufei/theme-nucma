/**
 * 打字机效果
 * 实现文本逐字显示的动画效果
 */

class Typewriter {
  constructor(element, options = {}) {
    this.element = typeof element === 'string'
      ? document.querySelector(element)
      : element;

    if (!this.element) {
      console.error('Typewriter: 元素不存在');
      return;
    }

    // 检查是否启用减弱动画
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.options = {
      text: options.text || this.element.textContent,
      speed: options.speed || 100, // 打字速度（毫秒/字符）
      delay: options.delay || 0, // 开始延迟
      pause: options.pause || 1000, // 完成后暂停时间
      cursor: options.cursor !== false, // 是否显示光标
      cursorChar: options.cursorChar || '|', // 光标字符
      loop: options.loop || false, // 是否循环
      deleteSpeed: options.deleteSpeed || 50, // 删除速度
      deleteDelay: options.deleteDelay || 500, // 删除前延迟
      ...options
    };

    this.originalText = this.element.textContent;
    this.currentText = '';
    this.currentIndex = 0;
    this.isDeleting = false;
    this.isPaused = false;
    this.timeout = null;
    this.visibilityHandler = null;

    this.init();
  }

  init() {
    // 如果启用减弱动画，直接显示文本
    if (this.isReducedMotion) {
      this.element.textContent = this.options.text;
      return;
    }

    // 清空元素
    this.element.textContent = '';

    // 添加光标
    if (this.options.cursor) {
      this.cursor = document.createElement('span');
      this.cursor.className = 'typewriter-cursor';
      this.cursor.textContent = this.options.cursorChar;
      this.element.appendChild(this.cursor);
    }

    // 页面可见性处理
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // 开始打字
    setTimeout(() => this.start(), this.options.delay);
  }

  start() {
    this.type();
  }

  // 打字
  type() {
    if (this.isPaused || this.isReducedMotion) return;

    const fullText = this.options.text;

    if (this.isDeleting) {
      // 删除字符
      this.currentText = fullText.substring(0, this.currentIndex - 1);
      this.currentIndex--;
    } else {
      // 添加字符
      this.currentText = fullText.substring(0, this.currentIndex + 1);
      this.currentIndex++;
    }

    // 更新显示
    this.updateDisplay();

    // 控制速度
    let typeSpeed = this.options.speed;

    if (this.isDeleting) {
      typeSpeed = this.options.deleteSpeed;
    }

    // 添加随机性，让打字更自然
    typeSpeed += Math.random() * 50;

    // 完成或开始删除
    if (!this.isDeleting && this.currentText === fullText) {
      // 打字完成
      typeSpeed = this.options.pause;

      if (this.options.loop) {
        this.isDeleting = true;
        this.isPaused = true;
        setTimeout(() => {
          this.isPaused = false;
          this.type();
        }, this.options.deleteDelay);
      }
    } else if (this.isDeleting && this.currentText === '') {
      // 删除完成
      this.isDeleting = false;
      this.currentIndex = 0;

      if (this.options.loop) {
        typeSpeed = 500;
      } else {
        return; // 不循环，结束
      }
    }

    this.timeout = setTimeout(() => this.type(), typeSpeed);
  }

  // 更新显示
  updateDisplay() {
    if (this.options.cursor) {
      while (this.element.firstChild && this.element.firstChild !== this.cursor) {
        this.element.removeChild(this.element.firstChild);
      }
      const textNode = document.createTextNode(this.currentText);
      this.element.insertBefore(textNode, this.cursor);
    } else {
      this.element.textContent = this.currentText;
    }
  }

  // 暂停
  pause() {
    this.isPaused = true;
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  // 恢复
  resume() {
    if (this.isReducedMotion) return;
    this.isPaused = false;
    this.type();
  }

  // 重置
  reset() {
    this.pause();
    this.currentText = '';
    this.currentIndex = 0;
    this.isDeleting = false;
    this.isPaused = false;
    this.element.textContent = '';
    if (this.options.cursor) {
      this.element.appendChild(this.cursor);
    }
  }

  // 销毁
  destroy() {
    this.pause();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.element.textContent = this.originalText;
  }
}

// 批量初始化
function initTypewriters() {
  const elements = document.querySelectorAll('[data-typewriter]');
  elements.forEach(el => {
    const text = el.getAttribute('data-typewriter');
    const speed = parseInt(el.getAttribute('data-typewriter-speed')) || 100;
    const delay = parseInt(el.getAttribute('data-typewriter-delay')) || 0;
    const loop = el.getAttribute('data-typewriter-loop') === 'true';

    new Typewriter(el, {
      text,
      speed,
      delay,
      loop,
      cursor: true
    });
  });
}

// 导出
window.Typewriter = Typewriter;
window.initTypewriters = initTypewriters;

// 添加打字机光标样式
const typewriterStyle = document.createElement('style');
typewriterStyle.textContent = `
  .typewriter-cursor {
    display: inline-block;
    animation: typewriterBlink 1s step-end infinite;
    color: rgb(var(--color-accent));
    font-weight: bold;
  }

  @keyframes typewriterBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .typewriter-cursor {
      animation: none;
      opacity: 1;
    }
  }
`;
document.head.appendChild(typewriterStyle);

// 自动初始化打字机元素
(function autoInit() {
  function init() {
    initTypewriters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
