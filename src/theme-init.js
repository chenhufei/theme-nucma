class ThemeInitializer {
  constructor() {
    this.config = window.themeConfig || {};
    this.isInitialized = false;
    this.systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    this.services = [];
  }

  init() {
    if (this.isInitialized) return;

    this.initThemeMode();
    this.initEnhancements();
    this.isInitialized = true;

    if (window.Logger && typeof window.Logger.log === 'function') {
      window.Logger.log('theme initialized');
    }
  }

  initThemeMode() {
    let savedMode;
    try { savedMode = localStorage.getItem('theme-mode'); } catch {}
    savedMode = savedMode || this.config.appearance?.default_theme_mode || 'system';
    this.applyThemeMode(savedMode, { emitEvent: false });
    this.bindSystemThemeChange();
  }

  resolveThemeMode(mode) {
    if (mode === 'system') {
      return this.systemThemeMedia.matches ? 'dark' : 'light';
    }

    return mode === 'dark' ? 'dark' : 'light';
  }

  applyThemeMode(mode, options = {}) {
    const { emitEvent = true } = options;
    const actualMode = this.resolveThemeMode(mode);

    document.documentElement.setAttribute('data-theme', actualMode);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(actualMode);
    try { localStorage.setItem('theme-mode', mode); } catch {}
    try { localStorage.setItem('theme', actualMode); } catch {}
    this.updateThemeToggleButtons(mode);

    if (emitEvent) {
      window.dispatchEvent(new CustomEvent('themeChanged', {
        detail: {
          mode,
          actualMode
        }
      }));
    }
  }

  bindSystemThemeChange() {
    const handleSystemThemeChange = () => {
      let currentMode;
      try { currentMode = localStorage.getItem('theme-mode'); } catch {}
      if ((currentMode || 'system') === 'system') {
        this.applyThemeMode('system');
      }
    };

    if (typeof this.systemThemeMedia.addEventListener === 'function') {
      this.systemThemeMedia.addEventListener('change', handleSystemThemeChange);
    } else if (typeof this.systemThemeMedia.addListener === 'function') {
      this.systemThemeMedia.addListener(handleSystemThemeChange);
    }
  }

  updateThemeToggleButtons(mode) {
    document.querySelectorAll('.theme-mode-btn').forEach((button) => {
      button.classList.toggle('active', button.id === 'mode' + mode.charAt(0).toUpperCase() + mode.slice(1));
    });
  }

  initEnhancements() {
    const enhancements = window.ThemeEnhancements || {};
    const advancedConfig = this.config?.advanced || {};
    const readingProgressEnabled = !(advancedConfig.enable_reading_progress === false
      || String(advancedConfig.enable_reading_progress).toLowerCase() === 'false');

    this.toastManager = this.createService(enhancements.ThemeToastManager);
    if (readingProgressEnabled) {
      this.readingProgress = this.createService(enhancements.ThemeReadingProgress);
    }
    this.contentEnhancer = this.createService(enhancements.ThemeContentEnhancer, this.config, this.toastManager);
  }

  createService(ServiceClass, ...args) {
    if (typeof ServiceClass !== 'function') return null;

    const instance = new ServiceClass(...args);
    if (typeof instance.init === 'function') {
      instance.init();
    }

    this.services.push(instance);
    return instance;
  }
}

window.themeInitializer = new ThemeInitializer();
window.applyThemeMode = (mode, options) => window.themeInitializer.applyThemeMode(mode, options);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeInitializer.init();
  });
} else {
  window.themeInitializer.init();
}
