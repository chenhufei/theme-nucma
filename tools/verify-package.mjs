import { existsSync, readFileSync } from 'node:fs';
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
  const required = ['theme.yaml', 'settings.yaml', 'templates/layout.html', 'templates/assets/css/main.css', 'templates/assets/css/KuaiKanShiJieTi.woff2', 'templates/assets/js/main.js', 'templates/assets/js/members.js', 'templates/assets/js/links.js', 'templates/assets/build-info.json'];
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
}

if (failures.length) {
  console.error(`安装包检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`安装包检查通过：${zipPath}`);
