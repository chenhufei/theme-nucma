import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as yaml from 'js-yaml';
import { collectKeys, render, DICT_PATH } from './gen-i18n-dict.mjs';
import { LEGACY_GROUP, LEGACY_FIELD_MAP } from './legacy-settings-map.mjs';

const root = process.cwd();
const failures = [];
const built = process.argv.includes('--built');

function read(path) {
  // 换行符归一：Windows 下 core.autocrlf=true 会把工作区检出为 CRLF，
  // 而契约里有多行精确匹配，不归一就会把「内容正确」误判成失败。
  return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
}

function fail(message) {
  failures.push(message);
}

function walk(directory, extension) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

const packageJson = JSON.parse(read('package.json'));
const theme = yaml.load(read('theme.yaml'));
const settings = yaml.load(read('settings.yaml'));
const gitignore = read('.gitignore');
const packageLock = read('package-lock.json');
const ciWorkflow = read('.github/workflows/ci.yaml');
const postcssConfig = read('postcss.config.js');
const viteConfig = read('vite.config.ts');

const packageCliVersion = packageJson.devDependencies?.['@halo-dev/theme-package-cli'];
if (!/^\d+\.\d+\.\d+$/.test(packageCliVersion || '')) {
  fail('主题打包工具必须使用固定版本');
}
// 打包必须走 tools/pack-theme.mjs：它负责资源指纹注入（见脚本头部说明），
// 直接调 theme-package 会跳过指纹，同版本重装时浏览器继续吃旧缓存。
const packageScript = packageJson.scripts?.package || '';
if (!packageScript.includes('node tools/pack-theme.mjs') || packageScript.includes('npx ')) {
  fail('主题打包必须走 node tools/pack-theme.mjs，且不得用 npx 拉取未锁定的打包工具');
}
if (!existsSync(join(root, 'tools/pack-theme.mjs'))) {
  fail('缺少打包脚本：tools/pack-theme.mjs');
} else {
  const packTool = read('tools/pack-theme.mjs');
  for (const marker of ['@halo-dev/theme-package-cli', '(v=${theme.spec.version})']) {
    if (!packTool.includes(marker)) fail(`打包脚本缺少 ${marker}`);
  }
}
if (packageLock.includes('registry.npmmirror.com')) {
  fail('package-lock.json 不得固化第三方镜像下载地址');
}
for (const [name, version] of [
  ['tailwindcss', '4.3.3'],
  ['@tailwindcss/postcss', '4.3.3'],
  ['daisyui', '5.7.16'],
]) {
  if (packageJson.devDependencies?.[name] !== version) {
    fail(`${name} 必须锁定为 ${version}`);
  }
}
if (!postcssConfig.includes("'@tailwindcss/postcss'")) {
  fail('PostCSS 未使用 Tailwind CSS 4 官方适配器');
}
if (!viteConfig.includes("base: './'")) {
  fail('Vite 必须使用相对资源基址，避免主题字体被构建为站点根路径');
}
if (existsSync(join(root, 'tailwind.config.js'))) {
  fail('Tailwind CSS 4 不应保留旧版 tailwind.config.js');
}
for (const obsoletePackageManagerFile of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'yarn.lock']) {
  if (existsSync(join(root, obsoletePackageManagerFile))) {
    fail(`项目统一使用 npm，不应保留第二套包管理器文件：${obsoletePackageManagerFile}`);
  }
}
for (const marker of ['actions/setup-node@v6', 'npm ci', 'npm run package']) {
  if (!ciWorkflow.includes(marker)) fail(`主题 CI 缺少 ${marker}`);
}

const groups = settings.spec?.forms || [];
const groupNames = groups.map((form) => form.group);
if (new Set(groupNames).size !== groupNames.length) {
  fail('settings.yaml 存在重复设置分组');
}
// 组的顺序即后台看到的分区顺序（2026-11-04 重分类）：
//   全站外观（末尾是高级自定义代码）→ 首页（首屏 / 区块）→ 站点框架（页头、页脚）
//   → 内容页（文章、关于、成员与独立页面）→ 系统页面（404、登录注册）→ SEO。
// 一条线从上到下走完「先看长相，再看首页，再看每类页面，最后才碰代码」。
// 改动顺序要同步改这里，避免两份真相。
const expectedGroups = ['appearance', 'home_hero', 'home_sections', 'navigation', 'footer', 'sidebar', 'about', 'pages', 'system_pages', 'seo'];
if (JSON.stringify(groupNames) !== JSON.stringify(expectedGroups)) {
  fail(`设置分组顺序异常：${groupNames.join(', ')}`);
}

const appearanceForm = groups.find((form) => form.group === 'appearance');
const navigationForm = groups.find((form) => form.group === 'navigation');
if (appearanceForm?.formSchema?.some((node) => node.name === 'visual_style')) {
  fail('全站视觉风格开关已下线，外观组不应再包含 visual_style 字段');
}

function walkSchema(nodes, visitor) {
  for (const node of nodes || []) {
    visitor(node);
    walkSchema(node.children, visitor);
  }
}

for (const form of groups) {
  const fieldNames = (form.formSchema || []).map((node) => node.name).filter(Boolean);
  walkSchema(form.formSchema, (node) => {
    if (node.attrs?.style?.includes('grid-template-columns')) {
      fail(`${form.group} 设置仍包含人为分栏布局`);
    }
    if (node.$formkit === 'array' && (!node.itemLabels || node.itemLabels.length === 0)) {
      fail(`${form.group}.${node.name} 数组缺少折叠列表显示字段`);
    }
    if (node.if && !node.key) {
      fail(`${form.group}.${node.name || node.$el || 'schema'} 条件节点缺少唯一 key`);
    }
  });
  const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
  if (duplicates.length) fail(`${form.group} 设置存在重复字段：${[...new Set(duplicates)].join(', ')}`);
}

// 首页区块现在独立成 home_sections 组（2026-11-04 从 home_hero 拆出）。
// 注意：sidebar 组也有一个同名 section_blocks（文章页侧边栏），所以必须按组取，不能全局 find。
const homeSectionsForm = groups.find((form) => form.group === 'home_sections');
const homeSections = homeSectionsForm?.formSchema?.find((node) => node.name === 'section_blocks');
if (!homeSections) fail('首页区块组缺少 section_blocks');
const homeSectionDefaults = new Map((homeSections?.value || []).map((item) => [item.type, item]));
const homeSectionChildren = new Map((homeSections?.children || []).map((item) => [item.name, item]));
for (const type of ['news', 'members', 'links']) {
  if (!homeSectionDefaults.has(type)) fail(`首页区块默认值缺少 ${type}`);
}
for (const [name, expr] of [
  ['news_limit', "$value.type === 'news' && $value.display_style !== 'columns'"],
  ['category_blocks', "$value.display_style === 'columns'"],
  ['member_limit', "$value.type === 'members'"], ['member_pinned', "$value.type === 'members'"],
  ['link_limit', "$value.type === 'links'"], ['link_pinned', "$value.type === 'links'"],
]) {
  const child = homeSectionChildren.get(name);
  if (!child) fail(`首页区块子表单缺少 ${name}`);
  if ((child?.if || '').replace(/\s+/g, ' ') !== expr) fail(`首页区块子表单 ${name} 条件异常：${child?.if}`);
  if (!child?.key) fail(`首页区块子表单 ${name} 缺少唯一 key`);
}
// 文章显示样式的三个选项是「卡片网格 / 紧凑列表 / 分类分栏」，
// 卡片细分项（卡片样式、标题行数、行数）只在 grid 下出现，分类栏只在 columns 下出现。
const displayStyle = homeSectionChildren.get('display_style');
const displayStyleValues = displayStyle?.options?.map((option) => option.value) || [];
if (JSON.stringify(displayStyleValues) !== JSON.stringify(['grid', 'list', 'columns'])) {
  fail(`文章显示样式选项异常：${displayStyleValues.join(', ')}`);
}
for (const [name, expr] of [
  ['card_style', "$value.display_style === 'grid'"],
  ['title_lines', "$value.display_style === 'grid'"],
  ['news_rows', "$value.type === 'news' && $value.display_style === 'grid'"],
]) {
  const child = homeSectionChildren.get(name);
  if ((child?.if || '').replace(/\s+/g, ' ') !== expr) fail(`文章显示样式细分项 ${name} 条件异常：${child?.if}`);
  if (!child?.key) fail(`文章显示样式细分项 ${name} 缺少唯一 key`);
}
if (homeSectionChildren.get('category_blocks')?.$formkit !== 'array') {
  fail('首页文章分类栏必须使用内层 array');
}
for (const name of ['member_pinned', 'link_pinned']) {
  const field = homeSectionChildren.get(name);
  if (field?.multiple !== true || field?.sortable !== true) {
    fail(`首页内容排序 ${name} 必须支持多选和拖动`);
  }
}

// 首屏：每种版式只露出自己会读的字段，别把 11 套版式的设置全平铺在一屏里。
// 这张表是「版式 → 字段」的唯一真相，改模板里某个字段的显示条件时同步改这里。
const homeForm = groups.find((form) => form.group === 'home_hero');
if (homeForm?.formSchema?.some((node) => node.name === 'section_blocks')) {
  fail('首页区块应归属 home_sections 组，不能留在 home_hero');
}
const heroFields = new Map((homeForm?.formSchema || []).map((node) => [node.name, node]));
const heroPickers = new Map((heroFields.get('blocks')?.children || []).map((node) => [node.name, node]));
for (const [name, label] of [['post', '关联文章（可选）'], ['category', '关联分类 / 专栏（可选）']]) {
  const picker = heroPickers.get(name);
  if (!picker) fail(`首屏三块内容缺少选取器 ${name}`);
  if (picker?.label !== label) fail(`首屏三块内容 ${name} 的标签异常：${picker?.label}`);
  if (!picker?.action) fail(`首屏三块内容 ${name} 缺少远程数据源 action`);
  if (picker?.requestOption?.valueField !== 'status.permalink') {
    fail(`首屏三块内容 ${name} 应直接存永久链接（valueField: status.permalink）`);
  }
}
const HERO_SCOPED = ['eyebrow', 'stats', 'blocks', 'cover_image', 'member_limit', 'member_pinned', 'member_names', 'footnote', 'bg_carousel', 'carousel_interval', 'bg_overlay', 'full_width', 'min_height'];
for (const name of HERO_SCOPED) {
  const field = heroFields.get(name);
  if (!field) fail(`首屏设置缺少字段：${name}`);
  if (!field?.if) fail(`首屏设置 ${name} 必须按版式条件显示（if）`);
  if (!field?.key) fail(`首屏设置 ${name} 的条件缺少唯一 key`);
}
for (const name of ['title_line1', 'title_accent', 'lead', 'primary_text', 'primary_url', 'secondary_text', 'secondary_url']) {
  if (!heroFields.has(name)) fail(`首屏设置缺少通用字段：${name}`);
}
// 三块内容的跳转规则在 1 / 8 / 11 号版式里各写一条（Thymeleaf 没有 map），
// 5 处都必须以 nhHref 变量出现，漏一处就会出现「有的版式点不动」
const heroTpl = read('templates/modules/home-hero.html');
const nhHrefCount = (heroTpl.match(/nhHref=/g) || []).length;
if (nhHrefCount !== 5) {
  fail(`首屏三块内容的跳转规则应共用 5 处 nhHref（1/8 号各 1 处、11 号 3 处），实际 ${nhHrefCount} 处`);
}

const aboutForm = groups.find((form) => form.group === 'about');
const aboutBlocks = aboutForm?.formSchema?.find((node) => node.name === 'about_blocks');
const aboutBlockTypes = new Set(aboutBlocks?.children
  ?.find((node) => node.name === 'type')?.options?.map((option) => option.value) || []);
for (const type of ['content', 'stats', 'latest', 'categories', 'timeline', 'services', 'projects', 'members', 'links', 'faq']) {
  if (!aboutBlockTypes.has(type)) fail(`关于页区块类型缺少 ${type}`);
}
const aboutDefaultTypes = (aboutBlocks?.value || []).map((item) => item.type);
if (new Set(aboutDefaultTypes).size !== aboutDefaultTypes.length) {
  fail('关于页默认区块排序不得包含重复类型');
}
for (const type of aboutDefaultTypes) {
  if (!aboutBlockTypes.has(type)) fail(`关于页默认区块类型未出现在选项中：${type}`);
}
for (const name of ['timeline_items', 'service_items']) {
  const field = aboutForm?.formSchema?.find((node) => node.name === name);
  if (field?.$formkit !== 'array') fail(`关于页 ${name} 必须使用 array`);
}

if (/^templates\/$/m.test(gitignore)) {
  fail('.gitignore 不得排除整个 templates 目录，否则主题源码无法完整提交');
}

if (packageJson.version !== theme.spec.version) {
  fail(`版本不一致：package.json=${packageJson.version}，theme.yaml=${theme.spec.version}`);
}
if (theme.spec.requires !== '>=2.27.0') {
  fail(`Halo 最低版本未经预期维护：${theme.spec.requires}`);
}
if (theme.metadata.name !== packageJson.name) {
  fail('theme.yaml metadata.name 必须与 package.json name 一致');
}
if (theme.spec.settingName !== settings.metadata.name) {
  fail('theme.yaml settingName 必须与 settings.yaml metadata.name 一致');
}

const templates = walk('templates', '.html');
const layoutUsers = templates.filter((path) =>
  path !== join('templates', 'layout.html') &&
  !path.startsWith(join('templates', 'modules')) &&
  read(path).includes('~{modules/layout :: html('),
);
for (const path of layoutUsers) {
  const source = read(path);
  for (const parameter of ['description=', 'canonical=', 'image=', 'pageType=', 'robots=']) {
    if (!source.includes(parameter)) fail(`${relative(root, path)} 缺少 SEO 参数 ${parameter}`);
  }
}

const requiredH1 = [
  'templates/index.html', 'templates/post.html', 'templates/page.html',
  'templates/archives.html', 'templates/categories.html', 'templates/tags.html',
  'templates/links.html', 'templates/members.html',
];
for (const path of requiredH1) {
  if (!/<h1\b/i.test(read(path))) fail(`${path} 缺少 H1`);
}

for (const path of templates) {
  const imageTags = read(path).match(/<img\b[\s\S]*?>/gi) || [];
  imageTags.forEach((tag, index) => {
    if (!/\b(?:alt|th:alt)=/i.test(tag)) fail(`${path} 第 ${index + 1} 个 img 缺少 alt`);
    if (!/\bwidth=/i.test(tag) || !/\bheight=/i.test(tag)) fail(`${path} 第 ${index + 1} 个 img 缺少稳定尺寸`);
  });
}

const allTemplates = templates.map(read).join('\n');

// 设置项必须真的被消费：后台能填、模板与脚本都不读的字段就是「死设置」，
// 用户改完不会有任何效果（date_format 就是这么被发现的：声明了四年没人用）。
// 判定语料 = 全部模板 + src 下的脚本与样式（构建前的源码）。
// 匹配形态要求是**属性访问**（`.name` / `?.name`），避免子串误判
// （例如把 date_format 改成 date_formatX 仍然「包含」date_format）。
const sourceCorpus = walk('src', '.js').concat(walk('src', '.ts')).concat(walk('src', '.css'));
const consumptionCorpus = allTemplates + sourceCorpus.map(read).join('\n');
const unconsumedSettings = [];
for (const form of groups) {
  walkSchema(form.formSchema, (node) => {
    const name = node.name;
    if (!name || typeof name !== 'string') return;
    const pattern = new RegExp('[.?]\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (!pattern.test(consumptionCorpus)) {
      unconsumedSettings.push(`${form.group}.${name}`);
    }
  });
}
for (const item of unconsumedSettings) {
  fail(`设置项声明后没有任何模板或脚本消费（死设置）：${item}`);
}

// 资源版本参数只有一种写法：(v=${theme.spec.version})。打包时靠它注入内容指纹，
// 写成别的形式（硬编码版本、省略参数）就等于那条资源永远吃旧缓存。
for (const path of templates) {
  const source = read(path);
  for (const match of source.matchAll(/\(v=([^)\s"']+)\)/g)) {
    if (match[1] !== '${theme.spec.version}') {
      fail(path + ' 资源版本参数必须统一写成 (v=${theme.spec.version})：' + match[0]);
    }
  }
}
if (/href=["']javascript:/i.test(allTemplates)) {
  fail('模板不得使用 javascript: 链接');
}
if (/\b(?:onmouseover|onmouseout|th:onclick|onclick)=/i.test(allTemplates)) {
  fail('模板不得使用内联鼠标或导航事件');
}
for (const retiredCdn of [
  'cdnjs.cloudflare.com',
  'cdn.bootcdn.net',
  'cdn.jsdelivr.net',
  'unpkg.com',
]) {
  if (allTemplates.includes(retiredCdn)) fail(`模板仍引用高延迟 CDN：${retiredCdn}`);
}

for (const staleKey of [
  'enable_search', 'enable_theme_toggle', 'enable_back_to_top',
  'enable_post_comment', 'enable_page_comment', 'enable_links_comment',
  'enable_members_comment', 'hero_background', 'hero_backgrounds',
  'hero_bg_interval', 'hero_full_width', 'hero_overlay', 'hero_height',
  'navigation.header_links', 'footer.custom_items', 'footer.custom_title',
]) {
  if (allTemplates.includes(staleKey)) fail(`模板仍引用旧设置字段：${staleKey}`);
}

// 老配置组 content：已于 2026-11-03 完成迁移（生产站 configmap 已清空该组），
// 模板里的回落表达式全部撤掉，这里改成「出现即失败」，防止老组死灰复燃。
// 映射表仍保留：它是 scripts/migrate-theme-settings.mjs 搬数据的依据，
// 也记录了「老字段 → 现分组字段」的对应关系，供未迁移的站点使用。
const declaredFields = new Set();
for (const form of groups) {
  walkSchema(form.formSchema, (node) => {
    if (node.name && typeof node.name === 'string') declaredFields.add(node.name);
  });
}
for (const [legacyField, target] of Object.entries(LEGACY_FIELD_MAP)) {
  if (!declaredFields.has(target.field)) {
    fail(`老配置映射表指向了不存在的设置字段：${target.group}.${target.field}（来自 content.${legacyField}）`);
  }
}
if (allTemplates.includes(`theme.config.${LEGACY_GROUP}`)) {
  fail(`模板仍引用已迁移的老配置组 ${LEGACY_GROUP}：迁移完成后必须撤掉回落表达式`);
}

// 已从 settings.yaml 移除的组与字段：继续回退只会读到永久空值，等于死分支。
// 匹配时要求后面不再是标识符字符，避免 footer_menu 命中 footer_menus。
const hasRemovedFallback = (marker) =>
  new RegExp(`${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`).test(allTemplates);

for (const removedFallback of [
  'theme.config.hero',
  'theme.config.carousel',
  'theme.config.navigation?.footer_menu',
  'theme.config.footer?.footer_menu',
  'theme.config.home?.section_order',
  'theme.config.home?.category_blocks',
  'theme.config.home?.news_limit',
  'theme.config.home?.member_limit',
  'theme.config.home?.member_pinned',
  'theme.config.home?.link_limit',
  'theme.config.home?.link_pinned',
  'theme.config.sidebar?.section_order',
  // sidebar_menu 只属于 sidebar 组；navigation 组从未声明它，回落永远是空串
  'theme.config.navigation?.sidebar_menu',
]) {
  if (hasRemovedFallback(removedFallback)) {
    fail(`模板仍在回退已删除的设置项：${removedFallback}`);
  }
}

const contracts = [
  ['PluginMembers', "pluginFinder.available('PluginMembers')", 'memberFinder.listApprovedMembers()'],
  ['PluginLinks', "pluginFinder.available('PluginLinks')", 'simpleGroups', 'groups'],
  // PluginLinks 2.5 的访客申请走 api.link.halo.run 的 POST 接口：
  // 验证码 /link-applications/captcha，提交 /link-applications。
  // 旧检查要求 /links/apply/submit 与 /links/apply/captcha，这两个地址在插件里并不存在。
  ['PluginLinks 官方申请', 'data-official-link-apply-open', 'officialLinkApplyDialog', 'officialLinkApplyForm', '/apis/api.link.halo.run/v1alpha1/link-applications', 'officialLinkApplyCaptcha'],
  ['PluginSearchWidget', "pluginFinder.available('PluginSearchWidget')", 'data-widget-open="SearchWidget"'],
];
for (const [name, ...markers] of contracts) {
  for (const marker of markers) {
    if (!allTemplates.includes(marker)) fail(`${name} 契约缺少标记：${marker}`);
  }
}

// Halo 官方《与插件集成》要求：评论区域使用核心注入的组合条件 haloCommentEnabled，
// 不能绑定到某一个评论插件。该变量由 CommentEnabledVariableProcessor 结合
// 「站点评论开关」与「已启用的 CommentWidget 扩展」计算，主题自行判断会与之冲突。
if (!allTemplates.includes('haloCommentEnabled')) {
  fail('评论区域必须使用 Halo 组合条件 haloCommentEnabled');
}
if (/pluginFinder\.available\(\s*'PluginCommentWidget'/.test(allTemplates)) {
  fail('评论区域不得绑定到具体评论插件 PluginCommentWidget，应使用 haloCommentEnabled');
}

for (const marker of ['LinkSubmitWidget', 'data-link-application-enabled']) {
  if (allTemplates.includes(marker) || read('src/js/main.js').includes(marker)) {
    fail(`link-submit-next 已收缩为表单增强插件，主题不得再依赖其弹窗入口：${marker}`);
  }
}

const layout = read('templates/modules/layout.html');
// 全站页头只有一份标记：modules/site-header.html；layout 的 siteHeader 片段只负责套作用域。
// 首屏不内置页头（0.0.8 起），所以首页与内页用的是同一个粘性外壳。
const siteHeader = read('templates/modules/site-header.html');
const pageLayout = read('templates/layout.html');
if (!/th:fragment="html \(head, content\)"/.test(pageLayout)) {
  fail('templates/layout.html 必须声明 Halo 页面布局契约 html(head, content)');
}
for (const marker of ['${head == null}', 'th:replace="${head}"', 'th:replace="${content}"', '<halo:footer />']) {
  if (!pageLayout.includes(marker)) fail(`Halo 页面布局契约缺少 ${marker}`);
}
// Halo 注入的 head 标签不得由主题重复输出（开发者指南「主题 SEO」）
for (const [file, content] of [['templates/modules/layout.html', layout], ['templates/layout.html', pageLayout]]) {
  if (/<link[^>]*rel="icon"/.test(content)) {
    fail(`${file} 不得输出 favicon，DefaultFaviconHeadProcessor 已注入`);
  }
  if (/<meta[^>]*name="robots"[^>]*seoRobots/.test(content)) {
    fail(`${file} 不应自行推导 robots，Halo 会按「屏蔽搜索引擎」注入 noindex`);
  }
}
if (/<meta[^>]*name="description"/.test(pageLayout)) {
  fail('templates/layout.html 不得输出 description，由调用方 head 片段决定');
}
if (/<meta[^>]*name="description"/.test(layout) && !layout.includes('seoMetaDescription')) {
  fail('description 必须用 seoMetaDescription 判断是否由 Halo 注入，否则会重复');
}
// SEO 开关：canonical/OG/Twitter 与结构化数据必须可关闭（可能由插件提供）
for (const marker of ['enable_metadata', 'enable_structured_data']) {
  if (!read('settings.yaml').includes(marker)) {
    fail(`SEO 设置缺少可关闭开关：${marker}`);
  }
}
if (!layout.includes('theme.config.seo?.enable_metadata') || !layout.includes('theme.config.seo?.enable_structured_data')) {
  fail('SEO 标签必须受 theme.config.seo 开关保护');
}
// 版本敏感能力必须带版本范围，避免低版本插件下露出失效入口
if (!allTemplates.includes("pluginFinder.available('PluginLinks', '>=2.5.0')")) {
  fail('友链申请能力必须用插件版本范围守卫（PluginLinks >=2.5.0）');
}
const mainCss = read('src/css/main.css');
if (/transition:\s*all\b/i.test(mainCss)) {
  fail('样式不得使用 transition: all');
}
// 竖向基线：画框（页头页脚）必须比版心（正文）宽，两者不得合一
const heroCss = read('src/css/home-hero.css');
const cssPx = (name, css) => {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([0-9.]+)px`));
  return m ? Number(m[1]) : null;
};
const contentMax = cssPx('--content-max', mainCss);
const frameMax = cssPx('--frame-max', mainCss);
if (contentMax == null || frameMax == null) {
  fail('缺少竖向基线变量：--content-max / --frame-max 必须显式声明像素值');
} else if (frameMax <= contentMax) {
  fail(`画框必须比版心宽：--frame-max(${frameMax}) 应大于 --content-max(${contentMax})`);
}
for (const [selector, css] of [
  ['.site-footer .container', mainCss],
]) {
  const rule = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`, 's'))?.[0] || '';
  if (!rule.includes('max-width: var(--frame-max)')) {
    fail(`${selector} 必须走画框宽度（var(--frame-max)），不得退回版心`);
  }
}
for (const marker of ['--nh-hx:', '.nh--p42r .nh-hd { height: 64px; top: 16px; padding: 0 var(--nh-hx)']) {
  if (!heroCss.includes(marker)) fail(`首屏页头必须贴在画框线上，缺少：${marker}`);
}
// 8 号版式的品牌与导航都是绝对定位，工具区必须在流里右对齐，否则会掉到行首压在品牌下面
const cardsHeadRule = heroCss.match(/\.nh--cards \.nh-hd \{[^}]*\}/s)?.[0] || '';
if (!cardsHeadRule.includes('justify-content: flex-end')) {
  fail('8 号版式页头必须 justify-content: flex-end（否则明暗切换按钮压在品牌下面）');
}
if (!heroCss.includes('.nh--cards .nh-tools { margin-right: 42px; }')) {
  fail('8 号版式窄屏必须给工具区让出汉堡宽度（.nh--cards .nh-tools { margin-right: 42px; }）');
}
if (allTemplates.includes('data-priority') || read('src/js/main.js').includes('initPrioritySort')) {
  fail('主题不得继续依赖已移除的成员 priority 排序字段');
}

for (const marker of [
  'linkApplicationEnabled',
]) {
  if (!allTemplates.includes(marker)) fail(`官方友链申请契约缺少标记：${marker}`);
}
for (const marker of ['about-timeline-section', 'timeline_items', 'about-services-section', 'about-projects-section', 'project_items', 'about_blocks']) {
  if (!allTemplates.includes(marker)) fail(`关于页区块逻辑缺少标记：${marker}`);
}
for (const marker of [
  "#lists.contains(theme.config.about.about_blocks.![type], 'timeline')",
  "#lists.contains(theme.config.about.about_blocks.![type], 'services')",
  "#lists.contains(theme.config.about.about_blocks.![type], 'projects')",
  '旧排序中没有服务入口',
  '旧版本已保存的区块排序',
]) {
  if (allTemplates.includes(marker)) fail(`关于页不应保留自动追加区块逻辑：${marker}`);
}
for (const marker of ['value: projects', 'name: project_items', 'about-project-list', 'about-project-cover']) {
  if (!read('settings.yaml').includes(marker) && !allTemplates.includes(marker)) fail(`关于页项目展示契约缺少：${marker}`);
}
if (allTemplates.includes('allLinkGroups = ${linkFinder?.groupBy()}')) {
  fail('友链筛选应使用 simpleGroups，不能重复加载完整链接分组');
}
if (allTemplates.includes("#vars.get('simpleGroups')") ||
    allTemplates.includes("#vars.get('linkApplicationEnabled')") ||
    allTemplates.includes("#vars.get('csrfToken')")) {
  fail('官方 PluginLinks 变量必须使用直接变量引用，不能调用 WebEngineContext.get');
}
if (!mainCss.includes('@media (prefers-reduced-motion: reduce)')) {
  fail('动效缺少 prefers-reduced-motion 兜底');
}
for (const marker of [
  "font-family: 'KuaiKanShiJieTi'",
  "url('../fonts/KuaiKanShiJieTi.woff2')",
  "--font-display: 'KuaiKanShiJieTi'",
]) {
  if (!mainCss.includes(marker)) fail(`快看世界体源码声明缺少：${marker}`);
}
// 728KB 字体不做全站 preload：@font-face + font-display:swap 按需加载即可；
// 全站预载会白耗带宽，并触发 Chrome「preloaded but not used」提示。
if (pageLayout.includes('as="font"') || pageLayout.includes('assets/css/KuaiKanShiJieTi.woff2')) {
  fail('快看世界体不得做全站 preload（728KB 应交给 @font-face 按需加载）');
}
for (const marker of [
  '@import "tailwindcss" source(none)',
  '@plugin "daisyui"',
  'themes: false',
  '--color-base-100: var(--bg-primary)',
  '--color-primary: var(--primary)',
]) {
  if (!mainCss.includes(marker)) fail(`DaisyUI 设计系统缺少 ${marker}`);
}
for (const marker of [
  '--shadow-low:',
  '--shadow-mid:',
  '--shadow-high:',
  '.banner-bg-indicator:focus-visible',
]) {
  if (!mainCss.includes(marker)) fail(`视觉层级声明缺少 ${marker}`);
}
for (const [path, markers] of [
  ['templates/modules/site-header.html', ['btn btn-ghost btn-circle', 'menu menu-sm login-dropdown']],
  ['templates/members.html', ['input input-bordered page-search', 'btn btn-primary apply-btn', 'card card-border member-card']],
  ['templates/links.html', ['input input-bordered page-search', 'btn btn-primary apply-btn', 'card card-border link-card']],
  ['templates/post.html', ['card card-border sidebar-card']],
]) {
  const template = read(path);
  for (const marker of markers) {
    if (!template.includes(marker)) fail(`${path} 缺少 DaisyUI 组件 ${marker}`);
  }
}
if (!layout.includes('data-visual-style="portal"')) {
  fail('layout 缺少固定的 data-visual-style="portal" 数据属性');
}
if (layout.includes('th:data-visual-style')) {
  fail('layout 不应再动态读取 visual_style（该开关已下线）');
}
if (!layout.includes("setProperty('--primary-rgb'")) {
  fail('自定义主色未同步 primary-rgb');
}
for (const style of ['youth', 'civic', 'editorial']) {
  if (mainCss.includes(`[data-visual-style="${style}"]`)) {
    fail(`主样式不应再包含已下线的视觉预设 ${style}`);
  }
}
for (const marker of ['rel="canonical"', 'property="og:title"', 'name="twitter:card"', 'application/ld+json']) {
  if (!layout.includes(marker)) fail(`统一 SEO Head 缺少 ${marker}`);
}
for (const marker of ['name="theme-color"', 'rawSeoImage=', 'class="skip-link"', 'id="mainContent"']) {
  if (!layout.includes(marker)) fail(`统一页面基线缺少 ${marker}`);
}
for (const marker of [
  'class="mobile-nav-section mobile-nav-section--menu"',
  'aria-label="菜单导航"',
  'class="mobile-nav-section mobile-nav-section--custom"',
  'aria-label="自定义链接"',
]) {
  if (!layout.includes(marker)) fail(`移动端导航缺少分区标记：${marker}`);
}
if (!layout.includes('class="mobile-nav-link mobile-nav-link--custom"\n                   th:href="${link.url}"')) {
  fail('mobile custom links must keep their configured URL');
}
if (/<th:block[^>]*th:with="mobileHeaderLinks[^>]*th:if=/s.test(layout)) {
  fail('移动端自定义链接不得在同一节点用 th:if 读取 th:with 局部变量');
}
if (!mainCss.includes('.mobile-nav-section + .mobile-nav-section')) {
  fail('移动端菜单导航与自定义链接之间缺少分隔样式');
}
const mobileCustomLinkRule = mainCss.match(/\.mobile-nav-link--custom\s*\{[^}]*\}/s)?.[0] || '';
if (/\b(?:border|background)\s*:/.test(mobileCustomLinkRule)) {
  fail('移动端自定义链接不得使用卡片边框或背景');
}

const mainScript = read('src/js/main.js');
if (mainScript.includes('fallbackSelector') || mainScript.includes('link-application--hidden')) {
  fail('主题不得保留旧的友链申请回退脚本');
}
if (allTemplates.includes('id="link-application-form"')) {
  fail('旧版友链表单不得与官方 PluginLinks 原生申请契约并存');
}
for (const marker of [
  "document.readyState === 'loading'",
  "dataset.nucmaInitialized === 'true'",
  "wrap.classList.add('is-authenticated')",
  "user.metadata?.name === 'anonymousUser'",
  "user.spec?.disabled === true",
]) {
  if (!mainScript.includes(marker)) fail(`主题初始化或登录状态契约缺少：${marker}`);
}
for (const marker of [
  '.login-entry-wrap.is-authenticated .login-icon',
  '.category-cols-wrapper',
  '.category-cols--c3',
  '.home-sections > .section[data-home-section="members"] .member-grid',
  'transition-property: color, background-color, border-color, outline-color, box-shadow, fill, stroke, opacity',
  // 明暗切换必须给整页颜色属性补过渡，且图标动画不能被这条通配规则吃掉
  'html.theme-transitioning [data-theme-toggle] * {',
  '::view-transition-new(root)',
]) {
  if (!mainCss.includes(marker)) fail(`主题响应式或切换契约缺少：${marker}`);
}
if (!read('templates/index.html').includes("'category-cols--c' + catCols")) {
  fail('首页分类栏缺少确定性列数标记');
}
for (const [path, markers] of [
  ['templates/archives.html', ['class="join pagination"', 'join-item page-btn']],
  ['templates/category-grid.html', ['class="join pagination"', 'join-item page-btn']],
]) {
  const template = read(path);
  for (const marker of markers) {
    if (!template.includes(marker)) fail(`${path} 分页缺少 DaisyUI 语义：${marker}`);
  }
}
// 首页已改为卡片网格（便当格/门户条目流等），不再输出列表分页；反向守住，防止回退成旧分页按钮
if (read('templates/index.html').includes('join-item page-btn')) {
  fail('首页不应再输出列表分页（已改为卡片网格）');
}
if (!mainScript.includes('initWidgetOpeners')) {
  fail('插件 Widget 入口缺少统一事件适配');
}
const officialApplyScript = read('src/js/links.js');
for (const marker of ['initOfficialLinkApplication', 'showModal()', 'challengeId', 'X-XSRF-TOKEN', 'data-captcha-refresh', 'officialLinkApplyResult']) {
  if (!officialApplyScript.includes(marker)) fail(`官方友链申请交互缺少 ${marker}`);
}
const notFoundTemplate = read('templates/error/404.html');
if (!notFoundTemplate.includes('th:href="@{/}"') || !notFoundTemplate.includes('data-history-back')) {
  fail('404 页面返回链接必须提供首页回退');
}
// 404 工牌版：资源只在该页加载，配置全部走 theme.config.system_pages（404 与登录注册合并成「系统页面」组）
for (const marker of ['/assets/err404/err404.css', '/assets/err404/err404.js', '/assets/err404/qrcode.js', 'window.__ERR404__', 'error404_style']) {
  if (!notFoundTemplate.includes(marker)) fail(`404 模板缺少 ${marker}`);
}
const errorPageForm = groups.find((form) => form.group === 'system_pages');
if (!errorPageForm) {
  fail('设置缺少「系统页面」分组');
} else {
  const errorFields = errorPageForm.formSchema.map((node) => node.name);
  for (const name of ['error404_style', 'error404_title', 'error404_title_accent', 'error404_subtitle', 'error404_show_badge', 'error404_badge_members', 'error404_badge_flip', 'error404_animation', 'error404_strap_color']) {
    if (!errorFields.includes(name)) fail(`404 设置缺少字段：${name}`);
  }
  const styleNode = errorPageForm.formSchema.find((node) => node.name === 'error404_style');
  const styleValues = styleNode?.options?.map((option) => option.value) || [];
  if (JSON.stringify(styleValues) !== JSON.stringify(['badge', 'classic'])) {
    fail(`404 页面风格选项异常：${styleValues.join(', ')}`);
  }
  const animNode = errorPageForm.formSchema.find((node) => node.name === 'error404_animation');
  const animValues = animNode?.options?.map((option) => option.value) || [];
  if (JSON.stringify(animValues) !== JSON.stringify(['full', 'lite', 'off'])) {
    fail(`404 入场动画选项异常：${animValues.join(', ')}`);
  }
}
// 404 样式必须独立成包，且不得引用主题里不存在的 --header-height
const errCssPath = 'src/err404/err404.css';
if (!existsSync(join(root, errCssPath))) {
  fail('404 样式源文件缺失：src/err404/err404.css');
} else if (read(errCssPath).includes('var(--header-height')) {
  fail('404 样式引用了不存在的 var(--header-height)，应改用 --err404-h');
}
if (!mainScript.includes('initHistoryBackLinks')) {
  fail('主脚本缺少历史返回链接增强逻辑');
}
// 认证页：覆盖 Halo gateway 布局做外形，样式独立成包，配置走 theme.config.system_pages。
// 表单必须原样交给 Halo —— 自己重写字段名或 action 会直接登不上。
const gatewayLayoutPath = 'templates/gateway_fragments/layout.html';
if (!existsSync(join(root, gatewayLayoutPath))) {
  fail('缺少认证页布局模板：templates/gateway_fragments/layout.html');
} else {
  const gatewayLayout = read(gatewayLayoutPath);
  for (const marker of [
    'th:fragment="layout (title, head, body)"',
    'gateway_fragments/common::basicStaticResources',
    '/assets/auth/auth.css',
    'theme.config.system_pages',
    'th:replace="${body}"',
  ]) {
    if (!gatewayLayout.includes(marker)) fail(`认证页布局缺少 ${marker}`);
  }
  if (/name="(username|password|plainPassword)"/.test(gatewayLayout)) {
    fail('认证页布局不得自行重写表单字段，表单必须由 Halo 模板渲染');
  }
  // 暗色判定脚本必须在 body 里（#auth-ui 渲染完成后）执行。
  // 放 head 里同步执行时 getElementById('auth-ui') 恒为 null，暗色模式永远不生效。
  const darkScriptIdx = gatewayLayout.indexOf("setAttribute('data-scheme', 'dark')");
  if (darkScriptIdx < 0) {
    fail('认证页布局缺少明暗模式判定脚本');
  } else {
    const bodyIdx = gatewayLayout.indexOf('<body');
    const headEndIdx = gatewayLayout.indexOf('</head>');
    if (bodyIdx < 0 || headEndIdx < 0 || darkScriptIdx < bodyIdx) {
      fail('明暗模式脚本必须放在 <body> 内（#auth-ui 渲染完成后才存在）');
    }
  }
}
const authPageForm = groups.find((form) => form.group === 'system_pages');
if (!authPageForm) {
  fail('设置缺少「system_pages」分组（认证页字段）');
} else {
  const authFields = authPageForm.formSchema.map((node) => node.name);
  if (!authFields.includes('auth_polish')) fail('认证页设置缺少字段：auth_polish');
  // 认证页已收敛为「只留美化开关，其余读取站点数据 / 默认文案」
  for (const name of [
    'auth_layout', 'auth_primary_color', 'auth_radius', 'auth_story_show', 'auth_story_quote',
    'auth_story_note', 'auth_story_contact', 'auth_site_name', 'auth_brand_note', 'auth_logo',
    'auth_foot_text', 'auth_show_back', 'auth_motion', 'auth_dark_follow', 'auth_show_switch',
    'auth_title_login', 'auth_title_signup', 'auth_title_reset', 'auth_title_logout',
    'auth_lead_login', 'auth_lead_signup', 'auth_lead_reset',
  ]) {
    if (authFields.includes(name)) fail(`认证页设置不应再包含 ${name}（已改为读取站点数据）`);
  }
}
const authCssPath = 'src/auth/auth.css';
if (!existsSync(join(root, authCssPath))) {
  fail('认证页样式源文件缺失：src/auth/auth.css');
} else {
  const authCssSource = read(authCssPath);
  // 认证页刻意做成与线上 auth-ui 设计（auth-template-cfinccog）同构，
  // 这里守的是「结构骨架不能退化」：一旦类名漂移，整段样式就失效了。
  for (const marker of ['#auth-ui', '.auth-shell', '.auth-story', '.auth-card', '.auth-slot-header', '--auth-primary']) {
    if (!authCssSource.includes(marker)) fail(`认证页样式缺少 ${marker}`);
  }
  for (const marker of ['drawer-story', 'drawer-card', 'KuaiKanShiJieTi']) {
    if (!authCssSource.includes(marker)) fail(`认证页样式缺少线上设计特征 ${marker}`);
  }
  if (authCssSource.includes('var(--header-height')) {
    fail('认证页样式引用了不存在的 var(--header-height)');
  }
}
const sidebarRule = mainCss.match(/\.post-sidebar\s*\{[^}]*\}/s)?.[0] || '';
if (!sidebarRule.includes('position: sticky') || !sidebarRule.includes('top: 86px') || !sidebarRule.includes('overflow: visible') || !sidebarRule.includes('max-height: none')) {
  fail('桌面文章侧栏必须保持粘性定位，且不得创建独立滚动容器');
}
if (mainCss.includes('.post-sidebar.post-sidebar--flow') || mainScript.includes('initPostSidebar()')) {
  fail('文章侧栏不得因内容高度自动取消粘性定位');
}
if (mainScript.includes('initPostSidebarSizing') || mainScript.includes('--post-sidebar-sticky-top')) {
  fail('文章侧栏不得用脚本动态改写 sticky top');
}
if (!mainCss.includes('[data-visual-style="portal"] .home-sections > .section') || !mainCss.includes('padding-block: var(--space-lg)')) {
  fail('标准门户首页必须使用紧凑区块间距');
}
for (const style of ['portal']) {
  for (const marker of ['.banner-content', '.news-item', '.member-card', '.page-header', '.intro-stat', '.link-group-title', '.pagination', '.site-footer']) {
    if (!mainCss.includes(`[data-visual-style="${style}"] ${marker}`)) {
      fail(`视觉风格 ${style} 缺少结构差异 ${marker}`);
    }
  }
}
const membersScript = read('src/js/members.js');
const networkScript = read('src/js/modules/network.js');
const qqLinkScript = read('src/js/modules/qq-link.js');
const linksScript = read('src/js/links.js');
const linksTemplate = read('templates/links.html');
const membersTemplate = read('templates/members.html');
const postTemplate = read('templates/post.html');
const claimTemplate = read('templates/page_claim.html');
const claimScript = read('src/js/claim.js');
for (const [feature, source, markers] of [
  ['文章阅读进度', layout + mainScript, ['id="readingProgress"', 'initReadingProgress']],
  ['移动端文章目录', layout + mainScript, ['id="mobileTocDrawer"', 'id="mobileToc"', 'initArticleToc']],
  ['文章移动操作', layout + mainScript, ['id="articleMobileActions"', 'data-article-share', 'data-article-copy', 'initArticleActions']],
  ['文章图片可访问性', layout + mainScript, ['initImageAccessibility', "setAttribute('alt'"]],
  ['文章图片查看器', layout + mainScript, ['id="articleImageViewer"', 'initArticleImageViewer']],
  ['友链拼音搜索', linksTemplate + linksScript, ['data-link-search', 'id="linkSearchEmpty"', 'initLinkSearch', "import('pinyin-pro')", "pattern: 'first'", 'assets/js/links.js']],
  ['成员本地搜索', membersTemplate + membersScript, ['id="memberSearchInput"', "import('pinyin-pro')", 'initMemberFilters', 'recompute', 'assets/js/members.js']],
  ['成员本地二维码', membersTemplate + membersScript, ['data-member-qr', 'data-qr-text', "import('qrcode')", 'initMemberQrPopups', "removeProperty('width')", "removeProperty('height')", "setAttribute('aria-hidden'", 'pointerleave', 'focusout']],
  ['成员分布地图', membersTemplate + membersScript + mainCss, ['data-member-map', 'data-member-map-src', 'renderVectorMap', 'buildMapSvg', 'buildSouthSeaInset', 'member-map-svg', 'member-map-inset-frame', 'member-map-legend']],
  ['弹窗滚动条稳定', mainCss, ['scrollbar-gutter: stable']],
  ['认领弹窗表单节奏', membersTemplate + mainCss, ['claim-modal-form', 'claim-modal-field', 'claim-modal-label', 'claim-modal-input', 'claim-modal-actions', 'id="claimCodeHint"']],
  ['认领资料编辑与只读 QQ 头像', membersTemplate + claimTemplate + membersScript + claimScript + mainCss,
    ['claim-profile', 'data-claim-avatar-preview', 'data-avatar-hint', 'defaultQqAvatar',
     'setAvatarPreview', 'claim-mini-btn', 'id="claimName"', 'id="claimDisplayName"',
     'id="claimSchool"']],
  ['成员卡片补全链接定位', membersTemplate + mainCss, ['member-info-with-claim', '.member-info-with-claim .member-school { padding-right: 4.5rem; }', 'position: absolute;\n  right: 0;\n  bottom: 0;', 'border-radius: 999px;']],
  ['成员默认 QQ 头像', membersTemplate, ['q1.qlogo.cn', 'member-avatar-default']],
  ['成员状态徽章', membersTemplate + mainCss, ['member-status-badge--verified', 'member-status-badge--pending', '.member-name-row']],
  ['成员加入时间', membersTemplate + membersScript, ['spec.joinedAt', 'memberJoinedAt']],
  ['成员关系网视图', membersTemplate + membersScript + networkScript + mainCss,
    ['data-member-network', 'data-member-network-canvas', 'data-member-view="network"',
     'initMemberNetwork', 'member-network-tip', 'is-network-view', 'view.yaw', 'setMode']],
  ['成员关系星图旋转与连线依据', membersScript + networkScript,
    ['projectNode', 'CAM_Z', 'findHoveredLink', 'data-member-network-link-tip']],
  // 星图只画头像：节点不再有学校/簇这一层，名称画在头像下方
  ['成员星图只画头像', networkScript,
    ['MEMBER_WORLD_R', 'focusNode', 'drawLabels', 'nodeColor']],
  // 两段式点击：第一次聚焦关系网，再点同一个头像弹工作证
  ['成员星图两段式点击', networkScript + membersTemplate,
    ['activateNode', 'openBadge', 'relatedList', 'data-member-network-focus']],
  // 头像主色发光：跨域头像走插件同源代理才读得到像素
  ['成员星图头像主色', networkScript,
    ['sampleAvatarColor', 'AVATAR_PROXY', 'hslToRgb', 'getImageData']],
  // 关系分析：先问成员级大模型接口，退回学校级，再退回同校同组
  ['成员关系分析数据源', networkScript,
    ['member-affinity', 'school-affinity', 'applyAiRelations', 'buildLocalRelations']],
  ['QQ 加好友链接校验', membersScript + claimScript + qqLinkScript,
    ['normalizeQqLink', 'qm.qq.com', 'cgi-bin/qm/qr', 'decodeQrFromFile']],
  // /cgi-bin/qm/qr 的 path 恰好等于前缀，token 在 k 参数里：不能再拿"路径比前缀长"当判据，
  // 否则 QQ 客户端导出的二维码链接会整批被判成非法链接。
  ['QQ 二维码链接形态', qqLinkScript, ['isOfficialPath', 'QR_PATH', 'k=']],
]) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${feature} 缺少标记：${marker}`);
  }
}
// 高德地图接入已移除：主题源码与设置里不得再残留 Key/脚本引用
const amapLeak = ['data-amap-key', 'amap_key', 'webapi.amap.com', 'AMapSecurityConfig']
  .filter((marker) => (membersTemplate + membersScript + read('settings.yaml')).includes(marker));
if (amapLeak.length) fail(`高德地图接入应已移除：${amapLeak.join(', ')}`);
// 脱敏邮箱只在提示行回显一次；独立红字节点会让同一地址显示两遍且像报错。
if (membersTemplate.includes('data-claim-target-email') || membersScript.includes('targetEmail')) {
  fail('认领弹窗脱敏邮箱回显必须只保留一行');
}
if (!existsSync(join(root, 'src/data/china-provinces.json'))) {
  fail('缺少中国地图数据资产：src/data/china-provinces.json');
} else {
  const mapData = JSON.parse(read('src/data/china-provinces.json'));
  if (!Array.isArray(mapData.provinces) || mapData.provinces.length < 34) {
    fail(`中国地图省级要素不足：${mapData.provinces?.length ?? 0}`);
  }
  const southSea = mapData.southSea;
  if (!southSea || !southSea.dash || !southSea.islands || !southSea.hainan) {
    fail('中国地图缺少南海诸岛附图，公开版必须完整表示南海诸岛与九段线');
  } else if (!membersScript.includes('buildSouthSeaInset')) {
    fail('成员页未渲染南海诸岛附图');
  }
}
const literalLinkAttrs = templates
  .filter((path) => /(?:^|\s)(?:data-[a-z-]+|src|href)="@\{/.test(read(path)))
  .map((path) => relative(root, path).replaceAll('\\', '/'));
if (literalLinkAttrs.length) {
  fail(`Thymeleaf 链接表达式写在普通属性里会原样输出：${literalLinkAttrs.join(', ')}`);
}
if (!membersTemplate.includes('th:attr="data-member-map-src=@{')) {
  fail('成员地图数据地址必须用 th:attr 生成链接表达式');
}
if (postTemplate.includes('目录生成脚本')) {
  fail('标准文章模板仍包含旧的内联目录脚本');
}
for (const externalMemberResource of [
  'cdn.staticfile.net/pinyin-pro',
  'api.qrserver.com',
  'uapis.cn/api/v1/image/qrcode',
]) {
  if (membersTemplate.includes(externalMemberResource)) {
    fail(`成员页不得依赖外部搜索或二维码资源：${externalMemberResource}`);
  }
}
for (const dependency of ['pinyin-pro', 'qrcode']) {
  if (!packageJson.dependencies?.[dependency]) fail(`成员页本地能力缺少依赖：${dependency}`);
}
if (mainScript.includes('pinyin-pro') || mainScript.includes("import('qrcode')")) {
  fail('页面专用依赖不得打入全站主脚本');
}
for (const dependency of ['alpinejs', '@alpinejs/collapse', 'gsap']) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    fail(`全站交互已改用原生 API，不得重新引入：${dependency}`);
  }
}
for (const marker of [
  'initMobileMenu',
  'initLoginMenu',
  'IntersectionObserver',
  'requestAnimationFrame',
  'Element.prototype.animate',
]) {
  if (!mainScript.includes(marker)) fail(`原生交互实现缺少标记：${marker}`);
}
for (const forbiddenMarker of ['alpinejs', '@alpinejs/collapse', "from 'gsap'", 'ScrollTrigger', 'window.gsap', 'Alpine.start']) {
  if ((mainScript + allTemplates).includes(forbiddenMarker)) {
    fail(`源码仍残留旧交互库标记：${forbiddenMarker}`);
  }
}
for (const alpineDirective of ['x-data=', 'x-show=', 'x-if=', 'x-init=', 'x-collapse', 'x-cloak', '@click=', '@mouseenter=', '@mouseleave=']) {
  if (allTemplates.includes(alpineDirective)) fail(`模板仍残留 Alpine 指令：${alpineDirective}`);
}
for (const marker of ['id="mobileMenuToggle"', 'data-mobile-menu-close', 'aria-hidden="true"']) {
  if (!(layout + siteHeader).includes(marker)) fail(`移动菜单原生交互缺少标记：${marker}`);
}
for (const marker of ['<details class="collapse collapse-arrow faq-item"', '<summary class="collapse-title faq-question"']) {
  if (!read('templates/page_about.html').includes(marker)) fail(`关于页 FAQ 缺少原生折叠标记：${marker}`);
}
for (const [pageName, template] of [['成员页', membersTemplate], ['友链页', linksTemplate]]) {
  for (const marker of ['page-header-row--with-tools', 'page-header-tools', 'page-search']) {
    if (!template.includes(marker)) fail(`${pageName}页头搜索工具栏缺少标记：${marker}`);
  }
}
if (linksTemplate.indexOf('data-link-search') > linksTemplate.indexOf('class="link-filters"')) {
  fail('友链搜索框应与成员页一致放在页头工具栏');
}
if (!mainCss.includes('.page-search input:focus-visible')) {
  fail('page search input focus style is not isolated');
}
const footerForm = groups.find((form) => form.group === 'footer');
const footerMenus = footerForm?.formSchema?.find((node) => node.name === 'footer_menus');
const footerMenuField = footerMenus?.children?.find((node) => node.name === 'menu');
if (
  footerMenus?.$formkit !== 'array' ||
  footerMenuField?.$formkit !== 'select' ||
  footerMenuField.action !== '/api/v1alpha1/menus' ||
  footerMenuField.requestOption?.labelField !== 'spec.displayName'
) {
  fail('footer menus must be an array with a menu select that resolves labels from /api/v1alpha1/menus');
}
if (footerForm?.formSchema?.some((node) => node.name === 'footer_menu')) {
  fail('legacy footer menu must not remain visible in the settings form');
}
if (!layout.includes('theme.config.footer?.footer_menus')) {
  fail('footer menu rendering must include multi-column settings');
}
for (const marker of [
  '.footer-inner {',
  'flex-wrap: nowrap;',
  'flex: 1 1 0;',
  '.footer-col > * { width: 100%; text-align: center; }',
  '.footer-nav { display: flex; flex-direction: column; gap: 0.45rem; align-items: center; }',
  '.footer-custom-items { display: flex; flex-wrap: wrap; gap: var(--space-md); justify-content: center; }',
]) {
  if (!mainCss.includes(marker)) fail(`页脚分栏对齐契约缺少：${marker}`);
}
const customLinks = navigationForm?.formSchema?.find((node) => node.name === 'custom_links');
if (!customLinks?.itemLabels?.some((label) => label.type === 'image' && label.label === '$value.image')) {
  fail('custom navigation links must show configured images in the list label');
}
// 返回顶部已整体移除（页脚上方那块山丘造型）：模板、脚本、样式都不应再出现
const allScripts = ['src/js/main.js', 'src/js/members.js', 'src/js/links.js', 'src/js/claim.js']
  .map((path) => read(path)).join('\n');
for (const retired of ['back-to-top-mountain', 'back-to-top-wrap', 'id="backToTop"', 'back_to_top_enabled']) {
  if (layout.includes(retired) || mainCss.includes(retired) || allScripts.includes(retired)) {
    fail(`返回顶部已移除，但仍残留：${retired}`);
  }
}
const faqRule = mainCss.match(/\.faq-item\s*\{[^}]*\}/s)?.[0] || '';
const faqInteractiveCss = mainCss.match(/\.faq-item:hover\s*\{[^}]*\}[\s\S]*?\.faq-item\[open\],[\s\S]*?\{[^}]*\}/s)?.[0] || '';
if (!faqRule.includes('border-left: 4px solid var(--border-color)') || !faqInteractiveCss.includes('.faq-item[open],') || faqInteractiveCss.includes('border-left-color: var(--primary)') || faqInteractiveCss.includes('border-left-color: var(--primary-light)')) {
  fail('FAQ 必须保持常驻左侧边框，展开或聚焦时不得播放红色边框动画');
}
if (mainCss.includes('[data-visual-style="portal"] .member-card:hover { border-top') ||
    mainCss.includes('[data-visual-style="portal"] .link-card:hover { border-top')) {
  fail('标准门户的成员与友链卡片不得在聚焦时出现顶部边框');
}

for (const marker of [
  '--member-card-height',
  'width: var(--member-card-height)',
  'height: var(--member-card-height)',
]) {
  if (!mainCss.includes(marker)) fail(`成员二维码等高尺寸缺少样式：${marker}`);
}

// ===== i18n 契约：文案只住在 i18n/*.properties，模板与脚本不得写死中文 =====
const CJK = /[\u4e00-\u9fff]/;
for (const path of ['i18n/default.properties', 'i18n/en.properties']) {
  if (!existsSync(join(root, path))) fail(`主题 i18n 资源缺失：${path}`);
}

function parseProperties(path) {
  const map = new Map();
  for (const rawLine of read(path).split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (map.has(key)) fail(`${path} 存在重复键：${key}`);
    map.set(key, line.slice(eq + 1));
  }
  return map;
}

if (existsSync(join(root, 'i18n/default.properties'))) {
  const zhMessages = parseProperties('i18n/default.properties');
  const enMessages = parseProperties('i18n/en.properties');
  for (const [key, value] of zhMessages) {
    if (!value.trim()) fail(`中文包为空值：${key}`);
    if (!enMessages.has(key)) fail(`英文包缺少 key：${key}`);
    else if (!enMessages.get(key).trim()) fail(`英文包为空值：${key}`);
  }
  for (const key of enMessages.keys()) {
    if (!zhMessages.has(key)) fail(`英文包多出 key：${key}`);
  }

  // 模板里 #{...} 与 #messages.msg('...') 引用的 key 必须都有译文
  const templateText = templates.map((path) => read(path)).join('\n');
  const referenced = new Set();
  for (const match of templateText.matchAll(/#\{([A-Za-z0-9_.]+)/g)) referenced.add(match[1]);
  for (const match of templateText.matchAll(/#messages\.msg\('([A-Za-z0-9_.]+)'/g)) referenced.add(match[1]);
  const missingInTemplate = [...referenced].filter((key) => !zhMessages.has(key));
  if (missingInTemplate.length) fail(`模板引用了未定义的 i18n key：${missingInTemplate.join(', ')}`);

  // 脚本侧字典由 properties 生成，必须与脚本引用保持同步
  const scriptKeys = collectKeys(root);
  const unknownScriptKeys = scriptKeys.filter((key) => !zhMessages.has(key));
  if (unknownScriptKeys.length) fail(`脚本引用了未定义的 i18n key：${unknownScriptKeys.join(', ')}`);
  if (!existsSync(join(root, DICT_PATH)) || read(DICT_PATH) !== render(scriptKeys)) {
    fail(`${DICT_PATH} 已过期，请运行 node tools/gen-i18n-dict.mjs`);
  }
  if (!read('templates/modules/layout.html').includes('modules/i18n-dict :: dict')) {
    fail('layout 没有引入 i18n 字典片段，脚本将拿不到译文');
  }

  // 模板文本节点 / 可读属性 / SpEL 字面量都不得出现中文
  const maskBlocks = (source) =>
    source
      .replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '))
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => block.replace(/[^\n]/g, ' '));
  for (const path of templates) {
    const source = maskBlocks(read(path));
    const lineOf = (position) => source.slice(0, position).split('\n').length;
    const tagBefore = (position) => {
      const start = source.lastIndexOf('<', position);
      return start < 0 ? '' : source.slice(start, position);
    };

    for (const match of source.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)) {
      if (tagBefore(match.index).includes('th:text')) continue;
      fail(`${path}:${lineOf(match.index)} 文本未走 i18n：${match[1].trim().slice(0, 40)}`);
    }
    for (const match of source.matchAll(
      /(?<![-\w:])(placeholder|aria-label|title|alt|aria-roledescription|label)="([^"]*[\u4e00-\u9fff][^"]*)"/g,
    )) {
      const start = source.lastIndexOf('<', match.index);
      const end = source.indexOf('>', match.index);
      const tag = start >= 0 && end > 0 ? source.slice(start, end) : '';
      if (tag.includes(`th:${match[1]}=`)) continue;
      fail(`${path}:${lineOf(match.index)} 属性 ${match[1]} 未走 i18n：${match[2].trim().slice(0, 40)}`);
    }
    // 内容匹配词白名单：这些「中文字面量」不是界面文案，
    // 而是拿页面输入做判断的匹配词（照抄会误伤，删了功能就坏）。
    const spelAllow = {
      // 认证页用 Halo 网关传入的 title 判断当前视图（退出/注册/登录），
      // Halo 输出的标题语言决定这里必须逐字匹配
      'templates/gateway_fragments/layout.html': ['退出', '注册', '创建', '登录'],
    };
    const allow = spelAllow[path.replaceAll('\\', '/')] ?? [];
    for (const match of source.matchAll(/'([^'\n\u0020]*[\u4e00-\u9fff][^'\n]*)'/g)) {
      if (allow.includes(match[1])) continue;
      fail(`${path}:${lineOf(match.index)} SpEL 字面量含中文：${match[1].trim().slice(0, 40)}`);
    }
  }

  // 内容图（宽度 >= 160 的封面/照片）必须声明 sizes，交给 Halo 注入 srcset；
  // 头像、logo、验证码这类固定小图不需要。
  const smallImageAllow = ['avatar', 'logo', 'captcha', 'claim-', 'articleImageViewerImage'];
  for (const path of templates) {
    const source = maskBlocks(read(path)).replace(/<!--[\s\S]*?-->/g, '');
    for (const match of read(path).matchAll(/<img\b[^>]*>/g)) {
      const tag = match[0];
      if (!tag.includes('th:src')) continue;
      const width = Number((tag.match(/\bwidth="(\d+)"/) || [])[1] || 0);
      if (width < 160) continue;
      if (tag.includes('sizes=')) continue;
      if (smallImageAllow.some((marker) => tag.includes(marker))) continue;
      fail(`${path} 内容图缺少 sizes 响应式声明：${tag.slice(0, 70)}`);
    }
    if (/\bsrcset=/.test(source)) fail(`${path} 不应手写 srcset，Halo 会按缩略图自动注入`);
  }

  // 脚本里不得留中文字面量；匹配词典 / 内容解析正则用 i18n-ignore 注释圈出例外
  for (const path of walk('src/js', '.js')) {
    const raw = read(path);
    const ignored = [];
    let inBlock = false;
    raw.split('\n').forEach((line, index) => {
      if (line.includes('i18n-ignore-start')) { inBlock = true; ignored[index] = true; return; }
      if (line.includes('i18n-ignore-end')) { inBlock = false; ignored[index] = true; return; }
      if (inBlock) ignored[index] = true;
      // 单行注释形式的 i18n-ignore 作用于「本行与其下一行」，让说明能写在被豁免代码上方
      if (line.includes('i18n-ignore')) {
        ignored[index] = true;
        ignored[index + 1] = true;
      }
    });
    const masked = raw
      .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, '');
    masked.split('\n').forEach((line, index) => {
      if (ignored[index]) return;
      if (CJK.test(line)) fail(`${path}:${index + 1} 脚本写死了中文：${line.trim().slice(0, 50)}`);
    });
  }
}

if (built) {
  for (const path of ['templates/assets/css/main.css', 'templates/assets/css/KuaiKanShiJieTi.woff2', 'templates/assets/js/main.js', 'templates/assets/js/members.js', 'templates/assets/js/links.js', 'templates/assets/data/china-provinces.json', 'templates/assets/build-info.json']) {
    if (!existsSync(join(root, path))) fail(`构建产物不存在：${path}`);
  }
  // 404 专用资源：模板按文件名引用，缺一个页面就整块失效
  for (const path of ['templates/assets/err404/err404.css', 'templates/assets/err404/err404.js', 'templates/assets/err404/qrcode.js', 'templates/assets/err404/duck.png']) {
    if (!existsSync(join(root, path))) fail(`404 资源未构建：${path}`);
  }
  if (existsSync(join(root, 'templates/assets/err404/err404.js'))) {
    const builtErrScript = read('templates/assets/err404/err404.js');
    for (const marker of ['__ERR404__', 'strapCanvas', 'badgeQr']) {
      if (!builtErrScript.includes(marker)) fail(`404 脚本缺少标记：${marker}`);
    }
  }
  if (!existsSync(join(root, 'templates/assets/auth/auth.css'))) {
    fail('认证页样式未构建：templates/assets/auth/auth.css');
  } else if (!read('templates/assets/auth/auth.css').includes('#auth-ui')) {
    fail('构建后的认证页样式缺少 #auth-ui');
  }
  if (existsSync(join(root, 'templates/assets/css/main.css'))) {
    const builtCss = read('templates/assets/css/main.css');
    if (!builtCss.includes('@font-face') || !builtCss.includes('KuaiKanShiJieTi.woff2')) {
      fail('构建样式缺少快看世界体声明');
    }
    for (const marker of ['--shadow-low:', '--shadow-mid:', '--shadow-high:']) {
      if (!builtCss.includes(marker)) fail(`构建样式缺少层级变量：${marker}`);
    }
    if (/url\(["']?\/css\/KuaiKanShiJieTi\.woff2/.test(builtCss)) {
      fail('快看世界体被错误构建为站点根路径');
    }
  }
  if (existsSync(join(root, 'templates/assets/build-info.json'))) {
    const info = JSON.parse(read('templates/assets/build-info.json'));
    if (info.version !== packageJson.version) fail('build-info.json 版本与 package.json 不一致');
  }
  if (existsSync(join(root, 'templates/assets/js/main.js'))) {
    const builtScript = read('templates/assets/js/main.js');
    for (const marker of ['readingProgress', 'mobileTocDrawer', 'articleImageViewer']) {
      if (!builtScript.includes(marker)) fail(`构建脚本缺少阅读体验标记：${marker}`);
    }
  }
  if (existsSync(join(root, 'templates/assets/js/members.js'))) {
    const builtMembersScript = read('templates/assets/js/members.js');
    for (const marker of ['memberSearchInput', 'data-member-qr', 'data-member-map-src', 'member-map-svg', 'member-map-inset-frame']) {
      if (!builtMembersScript.includes(marker)) fail(`成员页构建脚本缺少标记：${marker}`);
    }
    if (!walk('templates/assets/js/chunks', '.js').length) fail('成员页按需依赖分包不存在');
  }
  if (existsSync(join(root, 'templates/assets/data/china-provinces.json'))) {
    const builtMapData = JSON.parse(read('templates/assets/data/china-provinces.json'));
    if (!builtMapData.southSea?.dash || !builtMapData.southSea?.islands) {
      fail('构建产物中的中国地图缺少南海诸岛附图');
    }
  }
  if (existsSync(join(root, 'templates/assets/js/links.js'))) {
    const builtLinksScript = read('templates/assets/js/links.js');
    for (const marker of ['linkSearchInput', 'linkSearchResults']) {
      if (!builtLinksScript.includes(marker)) fail(`友链页构建脚本缺少标记：${marker}`);
    }
  }
  // 分享图二维码编码器：只在生成分享图时按需加载，独立成文件，不算死分包。
  if (existsSync(join(root, 'templates/assets/js/qr-encoder.js'))) {
    const builtQrEncoder = read('templates/assets/js/qr-encoder.js');
    for (const marker of ['var qrcode', 'createSvgTag']) {
      if (!builtQrEncoder.includes(marker)) fail(`二维码编码器构建产物缺少标记：${marker}`);
    }
  }
  const knownEntries = ['main.js', 'members.js', 'links.js', 'claim.js', 'qr-encoder.js'];
  const strayScripts = readdirSync(join(root, 'templates/assets/js'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !knownEntries.includes(entry.name))
    .map((entry) => entry.name);
  if (strayScripts.length) fail(`构建产物残留上一轮的死分包：${strayScripts.join(', ')}`);
  const maps = walk('templates/assets', '.map');
  if (maps.length) fail(`主题包不得包含 Sourcemap：${maps.join(', ')}`);
}

// ── layout fragment 参数一致性 ───────────────────────────────
// 事故复盘（v3.34.70）：给 modules/layout 的 html fragment 加了 headExtra 参数，
// 但 4 个错误页模板没同步，Thymeleaf 的严格签名校验直接抛
// 「declares parameter "headExtra", which is not specified at the fragment selection」。
// 错误页本身是异常兜底 → 兜底也炸 → 任何异常都升级成整站 500，只能回退主题。
// 所以把「签名 vs 所有调用点」的一致性做成构建期硬校验：加/删/改参数必须全量同步，
// 漏一个就在 npm run check 阶段报出来，而不是等到线上整站挂掉。
const layoutSource = read('templates/modules/layout.html');
const layoutSignature = layoutSource.match(/th:fragment="html\s*\(([^)]*)\)"/);
const signatureParams = layoutSignature
  ? layoutSignature[1].split(',').map((item) => item.trim()).filter(Boolean)
  : [];
if (!signatureParams.length) fail('modules/layout.html 未声明 html fragment 签名');

/** 从 '(' 开始做括号平衡扫描，按顶层逗号切开 fragment 实参。 */
function splitFragmentArgs(source, openIndex) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = openIndex + 1;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '|') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        parts.push(source.slice(start, index));
        return parts;
      }
    } else if (char === ',' && depth === 1) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  return parts;
}

const layoutCallMarker = 'modules/layout :: html';
for (const file of walk('templates', '.html')) {
  const source = read(file);
  let cursor = 0;
  while (true) {
    const hit = source.indexOf(layoutCallMarker, cursor);
    if (hit === -1) break;
    cursor = hit + layoutCallMarker.length;
    let open = hit + layoutCallMarker.length;
    while (open < source.length && source[open] !== '(' && source[open] !== '}') open += 1;
    if (source[open] !== '(') continue;
    const pieces = splitFragmentArgs(source, open);
    const passed = pieces
      .map((piece) => piece.match(/^\s*([A-Za-z_]\w*)\s*=/)?.[1])
      .filter(Boolean);
    const line = source.slice(0, hit).split('\n').length;
    const missing = signatureParams.filter((name) => !passed.includes(name));
    const unknown = passed.filter((name) => !signatureParams.includes(name));
    if (missing.length) {
      fail(`${file}:${line} 调用 layout :: html 缺少参数 ${missing.join(', ')}（签名要求：${signatureParams.join(', ')}）`);
    }
    if (unknown.length) {
      fail(`${file}:${line} 调用 layout :: html 传了签名里没有的参数 ${unknown.join(', ')}（签名要求：${signatureParams.join(', ')}）`);
    }
    // headExtra 指向的片段必须真的存在，否则同样在渲染期抛异常。
    // 允许带参数（如 modules/seo :: article(post=${post})），参数会作为 fragment 的形参传入。
    const headPiece = pieces.find((piece) => /^\s*headExtra\s*=/.test(piece));
    if (headPiece) {
      // 片段可以带参数：~{modules/seo :: article(post=${post})}
      const local = headPiece.match(/~\{\s*::\s*([\w-]+)\s*(?:\([^)]*\))?\s*\}/);
      const external = headPiece.match(/~\{\s*([\w./-]+)\s*::\s*([\w-]+)\s*(?:\([^)]*\))?\s*\}/);
      if (local) {
        if (!source.includes(`th:fragment="${local[1]}`)) {
          fail(`${file}:${line} 的 headExtra 引用了本模板不存在的片段 ${local[1]}`);
        }
      } else if (external) {
        const targetPath = `templates/${external[1]}.html`;
        if (!existsSync(join(root, targetPath))) {
          fail(`${file}:${line} 的 headExtra 指向不存在的模板 ${targetPath}`);
        } else if (!read(targetPath).includes(`th:fragment="${external[2]}`)) {
          fail(`${file}:${line} 的 headExtra 指向 ${targetPath} 里不存在的片段 ${external[2]}`);
        }
      } else {
        fail(`${file}:${line} 的 headExtra 值无法解析：${headPiece.trim()}`);
      }
    }
  }
}

/* ==========================================================================
   定向审查回归契约（2026-11-04）
   只锁「已被后台单项/组合切换实测证伪」的链路，防止以后把无效配置、
   死回落、固定列模板或与首屏下沿重合的分界线改回来。不扩大到无关模块。
   ========================================================================== */
const indexTpl = read('templates/index.html');

// ① 标题最多行数：后台默认 '0'=不限，前台必须真的不裁（不写 --title-lines / 不挂 clamp）
if (!indexTpl.includes("#lists.contains({'0', '1', '2', '3'}")) {
  fail('标题最多行数的合法值必须包含 0（后台默认「不限」）');
}
if (indexTpl.includes(": '2'}")) {
  fail('标题最多行数不得把 0 回退成 2 行截断');
}
if (!indexTpl.includes("newsTitleLines != '0' ? '--title-lines:' + newsTitleLines : null")) {
  fail('前台必须只在 title_lines 非 0 时写 --title-lines');
}
if (!indexTpl.includes("newsTitleLines != '0' ? ' article-grid--clamp' : ''")) {
  fail('前台必须只在 title_lines 非 0 时挂 article-grid--clamp');
}

// ② 每行列数只在卡片网格下可见：分类分栏的列数由 category_blocks 条目数决定，
//    columns 在 columns 样式下读不到、也不该露出（否则是「可设但无效」）。
const columnsChild = homeSectionChildren.get('columns');
if ((columnsChild?.if || '').replace(/\s+/g, ' ') !== "$value.type === 'news' && $value.display_style === 'grid'") {
  fail(`首页区块 columns 条件异常：分类分栏不读 columns，必须收窄到 grid`);
}
if (!columnsChild?.key) fail('首页区块子表单 columns 缺少唯一 key');

// ③ 12 号页脚：按 0.0.10 版式（品牌 1.75fr + 其余 1fr + 二维码 max-content）；
// 后台栏目多于 4 个时由脚本按真实 .footer-col 数覆盖 --l-cols
if (!layout.includes('1.75fr 1fr 1fr max-content')) {
  fail('12 号页脚兜底列必须保持 0.0.10 的 1.75fr 1fr 1fr max-content');
}
if (!layout.includes('if(n>4){')) {
  fail('12 号页脚必须按真实 .footer-col 数覆盖 --l-cols');
}

// ④ hero → 正文：细线不能压在首屏下沿，否则形成一条全宽硬分界
const heroSeamRule = heroCss.match(/\.nh \+ \.home-sections::before \{[^}]*\}/s)?.[0] || '';
if (/top:\s*0\s*;/.test(heroSeamRule)) {
  fail('首屏→正文的细线不得放在 top:0（与首屏下沿重合会变成全宽硬分界）');
}

// ⑤ 字体 728KB 不做全站 preload：@font-face + font-display:swap 按需加载即可。
//    全站预载会白耗带宽，并触发 Chrome「preloaded using link preload but not used」提示。
for (const tpl of ['templates/modules/layout.html', 'templates/layout.html', 'templates/gateway_fragments/layout.html']) {
  if (read(tpl).includes('as="font"')) {
    fail(`${tpl} 不得对 KuaiKanShiJieTi 做全站 preload（728KB 应交给 @font-face 按需加载）`);
  }
}

// ⑥ 设置项的条件显示：`if` 必须真的能用。
//    两个坑会让整组条件静默失效（所有带条件的项一律被隐藏）：
//    ① `$get(layout)` 参数裸写——FormKit 取不到名字，返回 undefined；
//    ② 被引用的字段没有显式 `id`——节点 id 是自动生成的，按 name 查不到。
//    另外条件节点必须带唯一 `key`，否则切换时会复用组件实例、出现显示错乱。
{
  const settingsRaw = read('settings.yaml');
  const badGet = [...settingsRaw.matchAll(/\$get\(\s*([A-Za-z_][\w]*)\s*\)/g)].map((m) => m[1]);
  if (badGet.length) {
    fail(`settings.yaml 的 $get 参数必须加引号（${[...new Set(badGet)].join(', ')}）`);
  }
  const conditionalNodes = [];
  const allNodes = [];
  for (const group of settings?.spec?.forms ?? []) {
    const walk = (nodes) => {
      for (const node of nodes ?? []) {
        if (!node || typeof node !== 'object') continue;
        if (node.name) allNodes.push(node);
        if (node.if) conditionalNodes.push({ group: group.group, node });
        if (Array.isArray(node.children)) walk(node.children);
      }
    };
    walk(group.formSchema);
  }
  const ids = new Set(allNodes.filter((n) => n.id).map((n) => n.id));
  const names = new Set(allNodes.filter((n) => n.name).map((n) => n.name));
  const referenced = new Set();
  for (const { node } of conditionalNodes) {
    for (const m of String(node.if).matchAll(/\$get\(\s*['"]([^'"]+)['"]\s*\)/g)) referenced.add(m[1]);
  }
  for (const ref of referenced) {
    if (!names.has(ref)) fail(`settings.yaml 的条件引用了不存在的字段：${ref}`);
    else if (!ids.has(ref)) fail(`settings.yaml 的字段 ${ref} 被条件引用，必须加显式 id: ${ref}`);
  }
  const keyCount = new Map();
  for (const { node } of conditionalNodes) {
    const k = node.key ?? node.name;
    keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    if (!node.key) fail(`settings.yaml 条件节点 ${node.name} 缺少唯一 key`);
  }
  for (const [k, n] of keyCount) if (n > 1) fail(`settings.yaml 条件节点的 key 重复：${k}`);
}

if (failures.length) {
  console.error(`主题检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`主题检查通过：${templates.length} 个模板，${contracts.length} 组插件契约${built ? '，构建产物已验证' : ''}`);
