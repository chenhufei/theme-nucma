// 主题打包：先算资源指纹，再在「暂存区」里把模板的 (v=${theme.spec.version})
// 换成 (v=<版本>-<指纹>)，最后交给本地固定版本的 theme-package 打 zip。
//
// 为什么必须这么做：
// Halo 把 /assets/** 当不可变资源，浏览器按「完整 URL」缓存。模板里只带版本号时，
// 同一个版本号重复安装（换测试包、打同一版补丁）资源 URL 完全不变，浏览器继续用旧
// CSS/JS —— 表现为「改了没生效」「样式错乱」。改成内容指纹后，只要构建产物字节变了，
// URL 就变，缓存自然失效；内容没变则指纹不变，正常复用缓存。
//
// 源码模板保持原样（永远写 v=${theme.spec.version}），指纹只存在于安装包里，
// 所以本地改模板不会污染工作区，check 阶段也能稳定校验写法。

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as yaml from 'js-yaml';

const root = process.cwd();
const stage = join(root, '.pack-stage');
const TOKEN = '(v=${theme.spec.version})';
const CLI = join(root, 'node_modules/@halo-dev/theme-package-cli/index.js');

function fail(message) {
  console.error(`打包失败：${message}`);
  process.exit(1);
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const themeYaml = yaml.load(readFileSync(join(root, 'theme.yaml'), 'utf8'));
if (themeYaml?.spec?.version !== packageJson.version) {
  fail(`theme.yaml 版本 ${themeYaml?.spec?.version} 与 package.json 版本 ${packageJson.version} 不一致，先跑 npm run check`);
}
if (!existsSync(CLI)) fail('缺少本地 theme-package，先执行 npm ci');

// ── 1. 资源指纹 ────────────────────────────────────────────────
// 覆盖 templates/assets 下所有构建产物（js / css / 字体 / 地图数据 / 404 与认证页资源）。
// 排除 build-info.json：它是构建元信息，随打包流程重写，不代表资源内容。
const assetsRoot = join(root, 'templates', 'assets');
if (!existsSync(assetsRoot)) fail('构建产物不存在，先执行 vite build');

const hash = createHash('sha256');
let hashedFiles = 0;
for (const file of walk(assetsRoot).sort()) {
  const rel = relative(assetsRoot, file).replaceAll('\\', '/');
  if (rel === 'build-info.json') continue;
  hash.update(rel);
  hash.update('\0');
  hash.update(readFileSync(file));
  hash.update('\0');
  hashedFiles += 1;
}
if (!hashedFiles) fail('templates/assets 为空，构建未产出资源');

const fingerprint = hash.digest('hex').slice(0, 8);
const assetVersion = `${packageJson.version}-${fingerprint}`;

// ── 2. 暂存区 ──────────────────────────────────────────────────
// theme-package 只认 cwd，且只会收 templates/**、i18n/**、根目录 yaml、README/LICENSE、截图。
// 这里按同一份清单把要进包的内容复制到 .pack-stage，改完再打包，避免动到工作区。
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
const stageEntries = ['templates', 'i18n', 'README.md', 'LICENSE'];
for (const entry of readdirSync(root)) {
  if (/\.ya?ml$/.test(entry) || /^screenshot\.(?:png|jpe?g|webp)$/i.test(entry)) stageEntries.push(entry);
}
if (existsSync(join(root, 'ui-plugin', 'dist'))) stageEntries.push(join('ui-plugin', 'dist'));
for (const entry of stageEntries) {
  const from = join(root, entry);
  if (!existsSync(from)) fail(`暂存清单里的 ${entry} 不存在`);
  cpSync(from, join(stage, entry), { recursive: statSync(from).isDirectory() });
}

// ── 3. 盖章 ────────────────────────────────────────────────────
// 只替换 (v=${theme.spec.version}) 这一种写法（Thymeleaf 链接表达式里的版本参数），
// 页面里 data-theme-version 之类的真实版本号保持原值，不受影响。
let stamped = 0;
const untouched = [];
for (const file of walk(join(stage, 'templates'))) {
  if (!file.endsWith('.html')) continue;
  const source = readFileSync(file, 'utf8');
  const count = source.split(TOKEN).length - 1;
  if (!count) continue;
  writeFileSync(file, source.split(TOKEN).join(`(v=${assetVersion})`), 'utf8');
  stamped += count;
  untouched.push(relative(stage, file).replaceAll('\\', '/'));
}
if (!stamped) fail(`暂存模板里没找到任何 ${TOKEN}，检查模板是否改了资源引用写法`);

// ── 4. 打包 ────────────────────────────────────────────────────
try {
  execFileSync(process.execPath, [CLI], { cwd: stage, stdio: 'inherit' });
  const zipName = `${packageJson.name}-${packageJson.version}.zip`;
  const built = join(stage, 'dist', zipName);
  if (!existsSync(built)) fail(`打包工具没有产出 ${zipName}`);
  mkdirSync(join(root, 'dist'), { recursive: true });
  renameSync(built, join(root, 'dist', zipName));
  console.log(`资源指纹：${fingerprint}（${hashedFiles} 个文件）→ 安装包内资源版本 ${assetVersion}`);
  console.log(`已写入 ${stamped} 处资源引用，涉及 ${untouched.length} 个模板`);
  console.log(`安装包：dist/${zipName}`);
} finally {
  // 暂存目录被占用（杀毒/编辑器索引）时不要连带把已经打好的包判成失败。
  try {
    rmSync(stage, { recursive: true, force: true });
  } catch (error) {
    console.warn(`暂存目录清理失败（不影响已生成的安装包）：${error.message}`);
  }
}
