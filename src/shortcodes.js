/**
 * 短代码解析器
 * 支持多种短代码格式
 */

class ShortcodeParser {
  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  constructor() {
    this.patterns = {
      alert: /\[alert\s+type="(info|success|warning|error)"\](.*?)\[\/alert\]/gs,
      collapse: /\[collapse\s+title="(.*?)"\](.*?)\[\/collapse\]/gs,
      tabs: /\[tabs\]([\s\S]*?)\[\/tabs\]/gs,
      tab: /\[tab\s+title="(.*?)"\]([\s\S]*?)\[\/tab\]/gs,
      timeline: /\[timeline\]([\s\S]*?)\[\/timeline\]/gs,
      item: /\[item\s+date="(.*?)"\]([\s\S]*?)\[\/item\]/gs,
      button: /\[button\s+text="(.*?)"\s+url="(.*?)"(?:\s+style="(primary|secondary|outline)")?\]/g,
      badge: /\[badge\s+style="(success|warning|error|info)"\](.*?)\[\/badge\]/g,
      quote: /\[quote\s+author="(.*?)"\](.*?)\[\/quote\]/gs
    };
  }

  // 解析所有短代码
  parse(content) {
    if (!content) return content;

    let parsed = content;

    // 解析各个短代码
    parsed = this.parseAlert(parsed);
    parsed = this.parseCollapse(parsed);
    parsed = this.parseTabs(parsed);
    parsed = this.parseTimeline(parsed);
    parsed = this.parseButton(parsed);
    parsed = this.parseBadge(parsed);
    parsed = this.parseQuote(parsed);

    return parsed;
  }

  // 解析提示块
  parseAlert(content) {
    const types = {
      info: { bg: 'bg-[rgba(var(--color-text),0.035)]', border: 'border-[rgba(var(--color-text),0.10)]', icon: '💡', text: 'theme-text-strong' },
      success: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '✅', text: 'text-green-800 dark:text-green-200' },
      warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', icon: '⚠️', text: 'text-yellow-800 dark:text-yellow-200' },
      error: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: '❌', text: 'text-red-800 dark:text-red-200' }
    };

    return content.replace(this.patterns.alert, (match, type, text) => {
      const style = types[type] || types.info;
      return `
        <div class="alert-shortcode ${style.bg} ${style.border} ${style.text} rounded-xl border p-4 my-4 flex items-start gap-3">
          <span class="text-xl">${style.icon}</span>
          <div class="flex-1 prose dark:prose-invert max-w-none">${text.trim()}</div>
        </div>
      `;
    });
  }

  // 解析折叠面板
  parseCollapse(content) {
    return content.replace(this.patterns.collapse, (match, title, body) => {
      return `
        <details class="collapse-shortcode group theme-surface-panel rounded-xl border overflow-hidden my-4">
          <summary class="flex items-center justify-between p-4 cursor-pointer hover:bg-[rgba(var(--color-text),0.035)] transition-colors select-none">
            <span class="font-medium theme-text-strong">${this.esc(title)}</span>
            <svg class="w-5 h-5 theme-text-soft group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 prose dark:prose-invert max-w-none">${body.trim()}</div>
        </details>
      `;
    });
  }

  // 解析标签页
  parseTabs(content) {
    return content.replace(this.patterns.tabs, (match, tabsContent) => {
      const tabRegex = /\[tab\s+title="(.*?)"\]([\s\S]*?)\[\/tab\]/g;
      const tabs = [];
      let tabMatch;

      while ((tabMatch = tabRegex.exec(tabsContent)) !== null) {
        tabs.push({ title: tabMatch[1], content: tabMatch[2].trim() });
      }

      const tabsHTML = tabs.map((tab, index) => `
        <button class="tab-button ${index === 0 ? 'active' : ''} px-4 py-2 text-sm font-medium border-b-2 transition-colors"
                data-tab="tab-${index}">
          ${this.esc(tab.title)}
        </button>
      `).join('');

      const contentHTML = tabs.map((tab, index) => `
        <div class="tab-panel ${index === 0 ? 'active' : ''} p-4 prose dark:prose-invert max-w-none"
             data-panel="tab-${index}">
          ${tab.content}
        </div>
      `).join('');

      return `
        <div class="tabs-shortcode theme-surface-panel my-4 rounded-xl border overflow-hidden">
          <div class="flex border-b theme-border-soft overflow-x-auto">
            ${tabsHTML}
          </div>
          ${contentHTML}
        </div>
      `;
    });
  }

  // 解析时间轴
  parseTimeline(content) {
    return content.replace(this.patterns.timeline, (match, itemsContent) => {
      const itemRegex = /\[item\s+date="(.*?)"\]([\s\S]*?)\[\/item\]/g;
      const items = [];
      let itemMatch;

      while ((itemMatch = itemRegex.exec(itemsContent)) !== null) {
        items.push({ date: itemMatch[1], content: itemMatch[2].trim() });
      }

      const itemsHTML = items.map((item, index) => `
        <div class="timeline-item relative pl-8 pb-8 ${index < items.length - 1 ? 'border-l-2 theme-border-soft' : ''}">
          <div class="absolute left-0 top-0 w-4 h-4 bg-[rgb(var(--color-accent))] rounded-full -translate-x-1/2"></div>
          <div class="timeline-date text-sm font-medium text-[rgb(var(--color-accent))] dark:text-[rgb(var(--color-accent-light))] mb-2">${this.esc(item.date)}</div>
          <div class="timeline-content prose dark:prose-invert max-w-none">${item.content}</div>
        </div>
      `).join('');

      return `
        <div class="timeline-shortcode my-6">${itemsHTML}</div>
      `;
    });
  }

  // 解析按钮
  parseButton(content) {
    const styles = {
      primary: 'bg-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent-dark))] text-white',
      secondary: 'bg-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-text))] text-white',
      outline: 'border-2 border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent))/0.08] dark:hover:bg-[rgb(var(--color-accent))/0.16]'
    };

    return content.replace(this.patterns.button, (match, text, url, style = 'primary') => {
      const styleClass = styles[style] || styles.primary;
      return `<a href="${this.esc(url)}" class="button-shortcode inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${styleClass}">${this.esc(text)}</a>`;
    });
  }

  // 解析徽章
  parseBadge(content) {
    const styles = {
      success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      info: 'bg-[rgba(var(--color-text),0.08)] text-[rgb(var(--color-text))]'
    };

    return content.replace(this.patterns.badge, (match, style, text) => {
      const styleClass = styles[style] || styles.info;
      return `<span class="badge-shortcode inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styleClass}">${this.esc(text)}</span>`;
    });
  }

  // 解析引用
  parseQuote(content) {
    return content.replace(this.patterns.quote, (match, author, text) => {
      return `
        <blockquote class="quote-shortcode my-6 pl-4 border-l-4 border-[rgba(var(--color-text),0.16)] bg-gradient-to-r from-[rgba(var(--color-text),0.035)] to-transparent py-3 pr-4">
          <p class="theme-text-muted italic mb-2">"${this.esc(text.trim())}"</p>
          <cite class="text-sm theme-text-soft not-italic">— ${this.esc(author)}</cite>
        </blockquote>
      `;
    });
  }

  // 初始化标签页交互
  initTabs() {
    document.querySelectorAll('.tabs-shortcode').forEach(tabsContainer => {
      const buttons = tabsContainer.querySelectorAll('.tab-button');
      const panels = tabsContainer.querySelectorAll('.tab-panel');

      buttons.forEach(button => {
        button.addEventListener('click', () => {
          const tabId = button.dataset.tab;
          const targetPanel = tabsContainer.querySelector(`[data-panel="${tabId}"]`);
          if (!targetPanel) return;

          buttons.forEach(btn => btn.classList.remove('active'));
          panels.forEach(panel => panel.classList.remove('active'));

          button.classList.add('active');
          targetPanel.classList.add('active');
        });
      });
    });
  }
}

// 初始化短代码解析器
const shortcodeParser = new ShortcodeParser();

// 在页面加载后解析短代码
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.prose, .content').forEach(el => {
      el.innerHTML = shortcodeParser.parse(el.innerHTML);
    });
    shortcodeParser.initTabs();
  });
} else {
  document.querySelectorAll('.prose, .content').forEach(el => {
    el.innerHTML = shortcodeParser.parse(el.innerHTML);
  });
  shortcodeParser.initTabs();
}

// 导出供全局使用
window.ShortcodeParser = ShortcodeParser;
