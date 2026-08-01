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
  const required = ['theme.yaml', 'settings.yaml', 'templates/layout.html', 'templates/assets/css/main.css', 'templates/assets/js/main.js', 'templates/assets/build-info.json'];
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
}

if (failures.length) {
  console.error(`安装包检查失败（${failures.length} 项）：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`安装包检查通过：${zipPath}`);
