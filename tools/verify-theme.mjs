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

const groups = settings.spec?.forms || [];
const groupNames = groups.map((form) => form.group);
if (new Set(groupNames).size !== groupNames.length) {
  fail('settings.yaml 存在重复设置分组');
}
const expectedGroups = ['appearance', 'navigation', 'home', 'sidebar', 'about', 'pages', 'footer'];
if (JSON.stringify(groupNames) !== JSON.stringify(expectedGroups)) {
  fail(`设置分组顺序异常：${groupNames.join(', ')}`);
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
for (const retiredCdn of [
  'cdnjs.cloudflare.com',
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
for (const marker of ['rel="canonical"', 'property="og:title"', 'name="twitter:card"', 'application/ld+json']) {
  if (!layout.includes(marker)) fail(`统一 SEO Head 缺少 ${marker}`);
}

const mainScript = read('src/js/main.js');
const linksTemplate = read('templates/links.html');
const postTemplate = read('templates/post.html');
for (const [feature, source, markers] of [
  ['文章阅读进度', layout + mainScript, ['id="readingProgress"', 'initReadingProgress']],
  ['移动端文章目录', layout + mainScript, ['id="mobileTocDrawer"', 'id="mobileToc"', 'initArticleToc']],
  ['文章图片查看器', layout + mainScript, ['id="articleImageViewer"', 'initArticleImageViewer']],
  ['友链实时搜索', linksTemplate + mainScript, ['data-link-search', 'id="linkSearchEmpty"', 'initLinkSearch']],
]) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${feature} 缺少标记：${marker}`);
  }
}
if (postTemplate.includes('目录生成脚本')) {
  fail('标准文章模板仍包含旧的内联目录脚本');
}

if (built) {
  for (const path of ['templates/assets/css/main.css', 'templates/assets/js/main.js', 'templates/assets/build-info.json']) {
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
  const maps = walk('templates/assets', '.map');
  if (maps.length) fail(`主题包不得包含 Sourcemap：${maps.join(', ')}`);
}

if (failures.length) {
  console.error(`主题检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`主题检查通过：${templates.length} 个模板，${contracts.length} 组插件契约${built ? '，构建产物已验证' : ''}`);
