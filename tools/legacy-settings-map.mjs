/**
 * 老配置组 `content` 的字段 → 现所在分组与字段名。
 *
 * 背景：`content` 是 2026-07-30 的 3.21.0 版引入的老分组，后来这些字段被拆进
 * appearance / navigation / sidebar / pages / about / footer 各组。Halo 升级时
 * **不会清理 ConfigMap 里已删除的分组**，所以老站点的 `theme-nucma-config` 里
 * 仍留着 `content` 这一组数据。
 *
 * 因此有两件事必须做，且必须用同一张表：
 *  1. 模板读新字段时要回落到老字段（`theme.config.content?.<旧字段>`），
 *     否则老站点升级后自定义 CSS/JS、备案号、评论开关等会静默丢失；
 *  2. 一次性迁移脚本按这张表把老数据搬进新组，然后删掉 `content` 组，
 *     搬完就能把模板里的回落删干净。
 *
 * 字段名有两代：3.21.0 一代带 `enable_` 前缀，拆组前已改成现行名字；
 * 两代都可能在老站点的配置里出现，所以都要覆盖。
 *
 * 单一真相：verify-theme.mjs 的断言与 scripts/migrate-theme-settings.mjs
 * 都从这里取，改这里一处即可。
 */
export const LEGACY_GROUP = 'content';

/**
 * 老字段名 → { group, field, template }：老字段在现配置里的落点。
 * `template: true` 表示这个字段现在仍被模板读取，模板必须写回落表达式；
 * `template: false` 表示当前没有模板消费点（只在老配置里存在），由迁移脚本负责搬运。
 */
export const LEGACY_FIELD_MAP = {
  // appearance 组
  date_format: { group: 'appearance', field: 'date_format', template: true },
  developer_mode: { group: 'appearance', field: 'developer_mode', template: true },
  custom_css: { group: 'appearance', field: 'custom_css', template: true },
  custom_js: { group: 'appearance', field: 'custom_js', template: true },
  // navigation 组
  search_enabled: { group: 'navigation', field: 'search_enabled', template: true },
  theme_toggle_enabled: { group: 'navigation', field: 'theme_toggle_enabled', template: true },
  // sidebar 组
  auto_toc: { group: 'sidebar', field: 'auto_toc', template: true },
  post_comment_enabled: { group: 'sidebar', field: 'post_comment_enabled', template: true },
  // pages 组
  page_comment_enabled: { group: 'pages', field: 'page_comment_enabled', template: true },
  links_comment_enabled: { group: 'pages', field: 'links_comment_enabled', template: true },
  members_comment_enabled: { group: 'pages', field: 'members_comment_enabled', template: true },
  // about 组
  faq_items: { group: 'about', field: 'faq_list', template: false },
  faq_list: { group: 'about', field: 'faq_list', template: false },
  // footer 组
  copyright: { group: 'footer', field: 'copyright', template: true },
  custom_column_title: { group: 'footer', field: 'custom_column_title', template: true },
  custom_column_items: { group: 'footer', field: 'custom_column_items', template: true },
  icp_number: { group: 'footer', field: 'icp_number', template: true },
  icp_link: { group: 'footer', field: 'icp_link', template: true },
  police_number: { group: 'footer', field: 'police_number', template: true },
  police_record_code: { group: 'footer', field: 'police_record_code', template: true },
  // 3.21.0 ~ 3.26.10 一代字段名：只存在于老配置里，由迁移脚本搬运，模板不写回落
  enable_search: { group: 'navigation', field: 'search_enabled', template: false },
  enable_theme_toggle: { group: 'navigation', field: 'theme_toggle_enabled', template: false },
  enable_post_comment: { group: 'sidebar', field: 'post_comment_enabled', template: false },
  enable_page_comment: { group: 'pages', field: 'page_comment_enabled', template: false },
  enable_links_comment: { group: 'pages', field: 'links_comment_enabled', template: false },
  enable_members_comment: { group: 'pages', field: 'members_comment_enabled', template: false },
  enable_custom_css: { group: 'appearance', field: 'custom_css', template: false },
  enable_custom_js: { group: 'appearance', field: 'custom_js', template: false },
};

/**
 * 模板里的回落表达式：读新字段，新字段没配时回落到老分组里的同名字段。
 * verify-theme 按这张表逐条核对模板里是否真的写了回落。
 */
export function legacyFallbackExpression(legacyField) {
  return `theme.config.${LEGACY_GROUP}?.${legacyField}`;
}

/**
 * 被并入其它组的分组（2026-11-03：`home`「首页横幅（旧版）」并入 `home_hero`「首页首屏」）。
 *
 * 背景：老版把「首页横幅」单列一个组，于是同一件事有两套字段：
 *   - 首屏版式：`home_hero.layout`（11 套新版） vs `home.hero_style`（浮标卡/杂志栏/经典）
 *   - 首屏文案：`home_hero.eyebrow/lead` vs `home.hero_eyebrow/hero_lead`
 *   - 关掉首屏：`home_hero.enabled=false` vs `home.show_hero=false`
 * 合并后只有一个 `layout` 取值决定首屏长什么样（含旧版横幅的三种样式）。
 *
 * 迁移规则：
 *   1. `move` 里的字段同名搬到 `to` 组（目标已有值则不覆盖）；
 *   2. `alias` 里的字段改名搬到 `to` 组（只补空位）；
 *   3. `layoutFrom` 用旧开关推出新 `layout`：先看 `enabled`，再看 `show_hero`；
 *   4. `drop` 里的字段直接丢弃（已被 layout 取代）。
 */
export const MERGED_GROUPS = [
  {
    from: 'home',
    to: 'home_hero',
    move: ['bg_carousel', 'carousel_interval', 'bg_overlay', 'full_width', 'min_height', 'section_blocks'],
    alias: { hero_eyebrow: 'eyebrow', hero_lead: 'lead' },
    layoutFrom: {
      enabledField: 'enabled',
      showField: 'show_hero',
      styleField: 'hero_style',
      legacyPrefix: 'legacy-',
      noneValue: 'none',
      fallback: 'floaters',
    },
    drop: ['show_hero', 'hero_style', 'enabled'],
  },
];

