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
  });
}

const allTemplates = templates.map(read).join('\n');
if (/href=["']javascript:/i.test(allTemplates)) {
  fail('模板不得使用 javascript: 链接');
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
  ['link-submit-next', "pluginFinder.available('link-submit-next')", 'LinkSubmitWidget.open()'],
  ['PluginSearchWidget', "pluginFinder.available('PluginSearchWidget')", 'SearchWidget.open()'],
];
for (const [name, ...markers] of contracts) {
  for (const marker of markers) {
    if (!allTemplates.includes(marker)) fail(`${name} 契约缺少标记：${marker}`);
  }
}

const layout = read('templates/layout.html');
const mainCss = read('src/css/main.css');
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
const notFoundTemplate = read('templates/error/404.html');
if (!notFoundTemplate.includes('th:href="@{/}"') || !notFoundTemplate.includes('data-history-back')) {
  fail('404 页面返回链接必须提供首页回退');
}
if (!mainScript.includes('initHistoryBackLinks')) {
  fail('主脚本缺少历史返回链接增强逻辑');
}
const membersScript = read('src/js/members.js');
const linksTemplate = read('templates/links.html');
const membersTemplate = read('templates/members.html');
const postTemplate = read('templates/post.html');
for (const [feature, source, markers] of [
  ['文章阅读进度', layout + mainScript, ['id="readingProgress"', 'initReadingProgress']],
  ['移动端文章目录', layout + mainScript, ['id="mobileTocDrawer"', 'id="mobileToc"', 'initArticleToc']],
  ['文章图片查看器', layout + mainScript, ['id="articleImageViewer"', 'initArticleImageViewer']],
  ['友链实时搜索', linksTemplate + mainScript, ['data-link-search', 'id="linkSearchEmpty"', 'initLinkSearch']],
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
  fail('成员页专用依赖不得打入全站主脚本');
}
for (const dependency of ['alpinejs', '@alpinejs/collapse', 'gsap']) {
  if (!packageJson.dependencies?.[dependency]) fail(`全站交互本地化缺少依赖：${dependency}`);
}
for (const marker of [
  "import Alpine from 'alpinejs'",
  "import collapse from '@alpinejs/collapse'",
  "import { gsap } from 'gsap'",
  'window.Alpine = Alpine',
  'window.gsap = gsap',
  'Alpine.start()',
]) {
  if (!mainScript.includes(marker)) fail(`全站交互本地化缺少初始化标记：${marker}`);
}
if (layout.includes('alpinejs') || layout.includes('gsap.min.js') || layout.includes('ScrollTrigger.min.js')) {
  fail('布局模板不得再通过外部脚本标签加载 Alpine 或 GSAP');
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
const customLinks = navigationForm?.formSchema?.find((node) => node.name === 'custom_links');
if (!customLinks?.itemLabels?.some((label) => label.type === 'image' && label.label === '$value.image')) {
  fail('custom navigation links must show configured images in the list label');
}
if (layout.includes('back-to-top-mountain') || layout.includes('bttp-particles-layer')) {
  fail('back-to-top decorative triangles must not remain in the layout');
}

for (const marker of [
  '--member-card-height',
  'width: var(--member-card-height)',
  'height: var(--member-card-height)',
]) {
  if (!mainCss.includes(marker)) fail(`成员二维码等高尺寸缺少样式：${marker}`);
}

if (built) {
  for (const path of ['templates/assets/css/main.css', 'templates/assets/js/main.js', 'templates/assets/js/members.js', 'templates/assets/build-info.json']) {
    if (!existsSync(join(root, path))) fail(`构建产物不存在：${path}`);
  }
  if (existsSync(join(root, 'templates/assets/build-info.json'))) {
    const info = JSON.parse(read('templates/assets/build-info.json'));
    if (info.version !== packageJson.version) fail('build-info.json 版本与 package.json 不一致');
  }
  if (existsSync(join(root, 'templates/assets/js/main.js'))) {
    const builtScript = read('templates/assets/js/main.js');
    for (const marker of ['readingProgress', 'mobileTocDrawer', 'articleImageViewer', 'linkSearchInput']) {
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
  const maps = walk('templates/assets', '.map');
  if (maps.length) fail(`主题包不得包含 Sourcemap：${maps.join(', ')}`);
}

if (failures.length) {
  console.error(`主题检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`主题检查通过：${templates.length} 个模板，${contracts.length} 组插件契约${built ? '，构建产物已验证' : ''}`);
