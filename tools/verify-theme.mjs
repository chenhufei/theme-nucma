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
for (const staleKey of [
  'enable_search', 'enable_theme_toggle', 'enable_back_to_top',
  'enable_post_comment', 'enable_page_comment', 'enable_links_comment',
  'enable_members_comment', 'hero_background', 'hero_backgrounds',
  'hero_bg_interval', 'hero_full_width', 'hero_overlay', 'hero_height',
  'navigation.header_links', 'footer.custom_items', 'footer.custom_title',
]) {
  if (allTemplates.includes(staleKey)) fail(`模板仍引用旧设置字段：${staleKey}`);
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

if (built) {
  for (const path of ['templates/assets/css/main.css', 'templates/assets/js/main.js', 'templates/assets/build-info.json']) {
    if (!existsSync(join(root, path))) fail(`构建产物不存在：${path}`);
  }
  if (existsSync(join(root, 'templates/assets/build-info.json'))) {
    const info = JSON.parse(read('templates/assets/build-info.json'));
    if (info.version !== packageJson.version) fail('build-info.json 版本与 package.json 不一致');
  }
  const maps = walk('templates/assets', '.map');
  if (maps.length) fail(`主题包不得包含 Sourcemap：${maps.join(', ')}`);
}

if (failures.length) {
  console.error(`主题检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`主题检查通过：${templates.length} 个模板，${contracts.length} 组插件契约${built ? '，构建产物已验证' : ''}`);
