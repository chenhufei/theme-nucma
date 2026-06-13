(function() {
  'use strict';

  const Logger = window.Logger || {
    log: (...args) => {
    error: (...args) => {
    },
    warn: (...args) => {
  };

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function mergeConfig(base, override) {
    const result = { ...base };

    Object.keys(override || {}).forEach((key) => {
      const overrideValue = override[key];
      const baseValue = result[key];

      if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
        result[key] = mergeConfig(baseValue, overrideValue);
      } else {
        result[key] = overrideValue;
      }
    });

    return result;
  }

  const defaultThemeConfig = {
    appearance: {
      default_theme_mode: 'system',
      card_radius: 'xl',
      body_font: 'misans',
      background_mode: 'mesh',
      background_image: '',
      background_position: 'center center',
      background_image_opacity: '0.28',
      background_pattern_opacity: '0.52',
      glass_strength: 'standard',
      glass_refraction: 'adaptive',
      glass_density: 'balanced'
    },
    home: {
      posts_per_page: 8,
      section_order_items: null,
      section_order: 'hero,about-alliance,service-directions,site-portal,posts,links,members,reviews,faq'
    },
    post: {
      show_cover: true,
      show_excerpt: true,
      show_reading_time: true,
      show_views: true,
      show_upvote: true,
      show_tags: true,
      show_author_card: true,
      date_format: 'yyyy年MM月dd日',
      paragraph_indent: false
    },
    advanced: {
      enable_image_lightbox: true,
      enable_code_copy: true,
      enable_reading_progress: true,
      enable_external_link_icon: true,
      mobile_toc_behavior: 'global',
      mobile_toc_min_headings: '5'
    }
  };

  window.themeConfig = mergeConfig(defaultThemeConfig, window.themeConfig || {});

  Logger.log('主题配置已加载');
})();
