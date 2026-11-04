import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import * as yaml from 'js-yaml';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const zipPath = join(root, 'dist', `${packageJson.name}-${packageJson.version}.zip`);
const failures = [];

if (!existsSync(zipPath)) {
  failures.push(`安装包不存在：${zipPath}`);
} else {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const find = (suffix) => entries.find((entry) => entry.entryName.replaceAll('\\', '/').endsWith(suffix));
  const required = ['theme.yaml', 'settings.yaml', 'templates/layout.html', 'templates/modules/layout.html', 'templates/assets/css/main.css', 'templates/assets/css/KuaiKanShiJieTi.woff2', 'templates/assets/js/main.js', 'templates/assets/js/members.js', 'templates/assets/js/links.js', 'templates/assets/js/claim.js', 'templates/assets/data/china-provinces.json', 'templates/assets/build-info.json'];
  required.forEach((path) => {
    if (!find(path)) failures.push(`安装包缺少：${path}`);
  });

  const themeEntry = find('theme.yaml');
  if (themeEntry) {
    const packagedTheme = yaml.load(themeEntry.getData().toString('utf8'));
    if (packagedTheme.spec.version !== packageJson.version) failures.push('安装包内 theme.yaml 版本不正确');
  }

  const infoEntry = find('templates/assets/build-info.json');
  if (infoEntry) {
    const info = JSON.parse(infoEntry.getData().toString('utf8'));
    if (info.version !== packageJson.version) failures.push('安装包内 build-info.json 版本不正确');
  }

  const forbidden = entries.filter((entry) => entry.entryName.endsWith('.map') || entry.entryName.includes('node_modules/'));
  if (forbidden.length) failures.push(`安装包含有禁止内容：${forbidden.map((entry) => entry.entryName).join(', ')}`);

  if (find('templates/header.html')) failures.push('安装包仍包含未使用的旧头部模板');
  const packagedSource = entries
    .filter((entry) => /\.(?:html|js|css|json|ya?ml)$/.test(entry.entryName))
    .map((entry) => entry.getData().toString('utf8'))
    .join('\n');
  for (const marker of ['alpinejs', '@alpinejs/collapse', 'ScrollTrigger', 'window.gsap', 'Alpine.start']) {
    if (packagedSource.includes(marker)) failures.push(`安装包仍包含旧交互库标记：${marker}`);
  }
  const packagedCss = find('templates/assets/css/main.css')?.getData().toString('utf8') || '';
  if (!packagedCss.includes('KuaiKanShiJieTi.woff2')) failures.push('安装包样式缺少快看世界体引用');
  if (/url\(["']?\/css\/KuaiKanShiJieTi\.woff2/.test(packagedCss)) failures.push('安装包中的快看世界体仍使用错误根路径');

  // ── 资源指纹 ────────────────────────────────────────────────
  // 模板里的 ?v= 必须是「版本号-内容指纹」，且指纹与包内资源字节吻合。
  // 这是「同版本重装吃旧缓存」的兜底：打包漏注入、或注入的指纹过期，这里直接失败，
  // 不用等到浏览器里出现样式错乱才发现。
  const normalize = (name) => name.replaceAll('\\', '/');
  const assetEntries = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = normalize(entry.entryName);
    const index = name.indexOf('templates/assets/');
    if (index < 0) continue;
    const rel = name.slice(index + 'templates/assets/'.length);
    if (!rel || rel === 'build-info.json') continue;
    assetEntries.push({ rel, entry });
  }
  assetEntries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const assetHash = createHash('sha256');
  for (const { rel, entry } of assetEntries) {
    assetHash.update(rel);
    assetHash.update('\0');
    assetHash.update(entry.getData());
    assetHash.update('\0');
  }
  const expectedVersion = `${packageJson.version}-${assetHash.digest('hex').slice(0, 8)}`;

  const versions = new Set();
  for (const entry of entries) {
    if (entry.isDirectory || !entry.entryName.endsWith('.html')) continue;
    const text = entry.getData().toString('utf8');
    for (const match of text.matchAll(/\(v=['"]?([^)\s"']+)['"]?\)/g)) {
      versions.add(match[1]);
      if (match[1].includes('${')) {
        failures.push(`${normalize(entry.entryName)} 资源版本参数未注入指纹：${match[0]}`);
      }
    }
  }
  if (versions.size !== 1) {
    failures.push(`安装包内资源版本参数不一致：${[...versions].join(', ') || '一处都没有'}`);
  } else {
    const [assetVersion] = [...versions];
    if (assetVersion !== expectedVersion) {
      failures.push(`资源版本 ${assetVersion} 与包内资源不匹配，期望 ${expectedVersion}（打包后又改过资源？）`);
    }
  }
}

if (failures.length) {
  console.error(`安装包检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`安装包检查通过：${zipPath}`);
