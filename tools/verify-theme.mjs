import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as yaml from 'js-yaml';

const root = process.cwd();
const failures = [];
const built = process.argv.includes('--built');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
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
if (!packageJson.scripts?.package?.includes('theme-package') || packageJson.scripts.package.includes('npx ')) {
  fail('主题打包必须使用本地固定版本的 theme-package');
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
for (const marker of ['actions/setup-node@v4', 'npm ci', 'npm run package']) {
  if (!ciWorkflow.includes(marker)) fail(`主题 CI 缺少 ${marker}`);
}

const groups = settings.spec?.forms || [];
const groupNames = groups.map((form) => form.group);
if (new Set(groupNames).size !== groupNames.length) {
  fail('settings.yaml 存在重复设置分组');
}
const expectedGroups = ['appearance', 'navigation', 'home', 'sidebar', 'about', 'pages', 'footer'];
if (JSON.stringify(groupNames) !== JSON.stringify(expectedGroups)) {
  fail(`设置分组顺序异常：${groupNames.join(', ')}`);
}

const appearanceForm = groups.find((form) => form.group === 'appearance');
const navigationForm = groups.find((form) => form.group === 'navigation');
const visualStyle = appearanceForm?.formSchema?.find((node) => node.name === 'visual_style');
const visualStyleValues = visualStyle?.options?.map((option) => option.value) || [];
if (JSON.stringify(visualStyleValues) !== JSON.stringify(['portal', 'youth', 'civic', 'editorial'])) {
  fail(`全站视觉风格选项异常：${visualStyleValues.join(', ')}`);
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

const homeForm = groups.find((form) => form.group === 'home');
const homeSections = homeForm?.formSchema?.find((node) => node.name === 'section_blocks');
const homeSectionDefaults = new Map((homeSections?.value || []).map((item) => [item.type, item]));
const homeSectionChildren = new Map((homeSections?.children || []).map((item) => [item.name, item]));
for (const type of ['news', 'members', 'links']) {
  if (!homeSectionDefaults.has(type)) fail(`首页区块默认值缺少 ${type}`);
}
for (const [name, type] of [
  ['news_limit', 'news'], ['category_blocks', 'news'],
  ['member_limit', 'members'], ['member_pinned', 'members'],
  ['link_limit', 'links'], ['link_pinned', 'links'],
]) {
  const child = homeSectionChildren.get(name);
  if (!child) fail(`首页区块子表单缺少 ${name}`);
  if (child?.if !== `$value.type === '${type}'`) fail(`首页区块子表单 ${name} 条件异常`);
  if (!child?.key) fail(`首页区块子表单 ${name} 缺少唯一 key`);
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

const aboutForm = groups.find((form) => form.group === 'about');
const aboutBlocks = aboutForm?.formSchema?.find((node) => node.name === 'about_blocks');
const aboutBlockTypes = new Set(aboutBlocks?.children
  ?.find((node) => node.name === 'type')?.options?.map((option) => option.value) || []);
for (const type of ['timeline', 'services']) {
  if (!aboutBlockTypes.has(type)) fail(`关于页区块类型缺少 ${type}`);
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
if (theme.spec.requires !== '>=2.22.0') {
  fail(`Halo 最低版本未经预期维护：${theme.spec.requires}`);
}
if (theme.metadata.name !== packageJson.name) {
  fail('theme.yaml metadata.name 必须与 package.json name 一致');
}
if (theme.spec.settingName !== settings.metadata.name) {
  fail('theme.yaml settingName 必须与 settings.yaml metadata.name 一致');
}

const templates = walk('templates', '.html');
const layoutUsers = templates.filter((path) => path !== join('templates', 'layout.html') && read(path).includes('layout :: html'));
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

for (const compatibilityMarker of [
  'theme.config.hero',
  'theme.config.carousel',
  'theme.config.content?.auto_toc',
  'theme.config.content?.post_comment_enabled',
  'theme.config.navigation?.footer_menu',
  'theme.config.home?.member_limit',
  'theme.config.home?.link_limit',
  'theme.config.home?.category_blocks',
  'newsBlock.category_blocks',
  'memberBlock.member_pinned',
  'linkBlock.link_pinned',
]) {
  if (!allTemplates.includes(compatibilityMarker)) {
    fail(`模板缺少旧配置回退：${compatibilityMarker}`);
  }
}

const contracts = [
  ['PluginMembers', "pluginFinder.available('PluginMembers')", 'memberFinder.listApprovedMembers()'],
  ['PluginLinks', "pluginFinder.available('PluginLinks')", 'linkFinder?.groupBy()'],
  ['link-submit-next', "pluginFinder.available('link-submit-next')", 'data-widget-open="LinkSubmitWidget"'],
  ['PluginSearchWidget', "pluginFinder.available('PluginSearchWidget')", 'data-widget-open="SearchWidget"'],
];
for (const [name, ...markers] of contracts) {
  for (const marker of markers) {
    if (!allTemplates.includes(marker)) fail(`${name} 契约缺少标记：${marker}`);
  }
}

const layout = read('templates/layout.html');
const mainCss = read('src/css/main.css');
if (/transition:\s*all\b/i.test(mainCss)) {
  fail('样式不得使用 transition: all');
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
for (const marker of ['rel="preload"', 'assets/css/KuaiKanShiJieTi.woff2', 'as="font"', 'type="font/woff2"']) {
  if (!layout.includes(marker)) fail(`快看世界体预加载缺少：${marker}`);
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
  '[data-theme="dark"][data-visual-style="youth"]',
  '[data-theme="dark"][data-visual-style="editorial"]',
  '--shadow-low:',
  '--shadow-mid:',
  '--shadow-high:',
  '.banner-bg-indicator:focus-visible',
]) {
  if (!mainCss.includes(marker)) fail(`视觉层级声明缺少 ${marker}`);
}
for (const [path, markers] of [
  ['templates/layout.html', ['btn btn-ghost btn-circle', 'menu menu-sm login-dropdown']],
  ['templates/members.html', ['input input-bordered page-search', 'btn btn-primary apply-btn', 'card card-border member-card']],
  ['templates/links.html', ['input input-bordered page-search', 'btn btn-primary apply-btn', 'card card-border link-card']],
  ['templates/post.html', ['badge badge-primary badge-soft', 'card card-border sidebar-card']],
]) {
  const template = read(path);
  for (const marker of markers) {
    if (!template.includes(marker)) fail(`${path} 缺少 DaisyUI 组件 ${marker}`);
  }
}
if (!layout.includes('th:data-visual-style="${theme.config.appearance?.visual_style ?: \'portal\'}"')) {
  fail('layout 缺少全站视觉风格数据属性');
}
if (!layout.includes("setProperty('--primary-rgb'")) {
  fail('自定义主色未同步 primary-rgb');
}
for (const style of ['youth', 'civic', 'editorial']) {
  if (!mainCss.includes(`[data-visual-style="${style}"]`)) {
    fail(`主样式缺少视觉预设 ${style}`);
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
for (const marker of [
  "document.readyState === 'loading'",
  "dataset.nucmaInitialized === 'true'",
  "wrap.classList.add('is-authenticated')",
]) {
  if (!mainScript.includes(marker)) fail(`主题初始化或登录状态契约缺少：${marker}`);
}
for (const marker of [
  '.login-entry-wrap.is-authenticated .login-icon',
  '.category-cols-wrapper.category-cols--count-3',
  '.home-sections > .section[data-home-section="members"] .member-grid',
  'transition-property: color, background-color, border-color, box-shadow, fill, stroke, opacity',
]) {
  if (!mainCss.includes(marker)) fail(`主题响应式或切换契约缺少：${marker}`);
}
if (!read('templates/index.html').includes('category-cols--count-')) {
  fail('首页分类栏缺少确定性列数标记');
}
for (const [path, markers] of [
  ['templates/index.html', ['class="join pagination"', 'join-item page-btn', 'join-item page-info']],
  ['templates/archives.html', ['class="join pagination"', 'join-item page-btn']],
  ['templates/category-grid.html', ['class="join pagination"', 'join-item page-btn']],
]) {
  const template = read(path);
  for (const marker of markers) {
    if (!template.includes(marker)) fail(`${path} 分页缺少 DaisyUI 语义：${marker}`);
  }
}
if (!mainScript.includes('initWidgetOpeners')) {
  fail('插件 Widget 入口缺少统一事件适配');
}
const notFoundTemplate = read('templates/error/404.html');
if (!notFoundTemplate.includes('th:href="@{/}"') || !notFoundTemplate.includes('data-history-back')) {
  fail('404 页面返回链接必须提供首页回退');
}
if (!mainScript.includes('initHistoryBackLinks')) {
  fail('主脚本缺少历史返回链接增强逻辑');
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
for (const style of ['portal', 'youth', 'civic', 'editorial']) {
  for (const marker of ['.banner-content', '.news-item', '.member-card', '.page-header', '.intro-stat', '.link-group-title', '.pagination', '.site-footer']) {
    if (!mainCss.includes(`[data-visual-style="${style}"] ${marker}`)) {
      fail(`视觉风格 ${style} 缺少结构差异 ${marker}`);
    }
  }
}
const membersScript = read('src/js/members.js');
const linksScript = read('src/js/links.js');
const linksTemplate = read('templates/links.html');
const membersTemplate = read('templates/members.html');
const postTemplate = read('templates/post.html');
for (const [feature, source, markers] of [
  ['文章阅读进度', layout + mainScript, ['id="readingProgress"', 'initReadingProgress']],
  ['移动端文章目录', layout + mainScript, ['id="mobileTocDrawer"', 'id="mobileToc"', 'initArticleToc']],
  ['文章移动操作', layout + mainScript, ['id="articleMobileActions"', 'data-article-share', 'data-article-copy', 'initArticleActions']],
  ['文章图片可访问性', layout + mainScript, ['initImageAccessibility', "setAttribute('alt'"]],
  ['文章图片查看器', layout + mainScript, ['id="articleImageViewer"', 'initArticleImageViewer']],
  ['友链拼音搜索', linksTemplate + linksScript, ['data-link-search', 'id="linkSearchEmpty"', 'initLinkSearch', "import('pinyin-pro')", "pattern: 'first'", 'assets/js/links.js']],
  ['成员本地搜索', membersTemplate + membersScript, ['id="memberSearchInput"', "import('pinyin-pro')", 'initMemberSearch', 'assets/js/members.js']],
  ['成员本地二维码', membersTemplate + membersScript, ['data-member-qr', 'data-qr-text', "import('qrcode')", 'initMemberQrPopups', "removeProperty('width')", "removeProperty('height')", "setAttribute('aria-hidden'", 'pointerleave', 'focusout']],
]) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${feature} 缺少标记：${marker}`);
  }
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
  if (!layout.includes(marker)) fail(`移动菜单原生交互缺少标记：${marker}`);
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
if (footerMenus?.$formkit !== 'array' || !footerMenus.children?.some((node) => node.$formkit === 'menuSelect' && node.name === 'menu')) {
  fail('footer menus must be an array with menuSelect children');
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
if (!layout.includes('back-to-top-mountain') || layout.includes('bttp-particles-layer')) {
  fail('返回顶部必须保留静态山丘序列，且不得恢复鼠标粒子层');
}
if (!layout.includes('<button th:if="${theme.config.appearance?.back_to_top_enabled != false}"') || !layout.includes('type="button" aria-label="返回顶部"')) {
  fail('返回顶部必须使用具有可访问名称的原生按钮');
}
const faqRule = mainCss.match(/\.faq-item\s*\{[^}]*\}/s)?.[0] || '';
if (!faqRule.includes('border-left: 4px solid transparent') || !mainCss.includes('.faq-item[open],') || !mainCss.includes('border-left-color: var(--primary)')) {
  fail('FAQ 展开或聚焦后必须保持左侧强调边框');
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

if (built) {
  for (const path of ['templates/assets/css/main.css', 'templates/assets/css/KuaiKanShiJieTi.woff2', 'templates/assets/js/main.js', 'templates/assets/js/members.js', 'templates/assets/js/links.js', 'templates/assets/build-info.json']) {
    if (!existsSync(join(root, path))) fail(`构建产物不存在：${path}`);
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
    for (const marker of ['memberSearchInput', 'data-member-qr']) {
      if (!builtMembersScript.includes(marker)) fail(`成员页构建脚本缺少标记：${marker}`);
    }
    if (!walk('templates/assets/js/chunks', '.js').length) fail('成员页按需依赖分包不存在');
  }
  if (existsSync(join(root, 'templates/assets/js/links.js'))) {
    const builtLinksScript = read('templates/assets/js/links.js');
    for (const marker of ['linkSearchInput', 'linkSearchResults']) {
      if (!builtLinksScript.includes(marker)) fail(`友链页构建脚本缺少标记：${marker}`);
    }
  }
  const maps = walk('templates/assets', '.map');
  if (maps.length) fail(`主题包不得包含 Sourcemap：${maps.join(', ')}`);
}

if (failures.length) {
  console.error(`主题检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`主题检查通过：${templates.length} 个模板，${contracts.length} 组插件契约${built ? '，构建产物已验证' : ''}`);
