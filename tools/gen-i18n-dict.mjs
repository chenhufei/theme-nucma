/**
 * 生成 templates/modules/i18n-dict.html。
 *
 * 模板文案走 Thymeleaf 的 #{...}，但前端脚本拿不到服务端消息，所以这里把
 * 「脚本里用 t('key') 引用的那批 key」列成一份 JSON 字典，值仍然由服务端
 * 从 i18n/*.properties 取当前语言——脚本侧不再出现任何中文字面量。
 *
 * 用法：node tools/gen-i18n-dict.mjs [--check]
 *   --check 只校验文件是否最新，不写盘（供 verify-theme 使用）
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DICT_PATH = 'templates/modules/i18n-dict.html';
const SOURCE_DIRS = ['src/js'];
const KEY_PATTERN = /\b(?:t|__nucmaT)\(\s*'([A-Za-z0-9_.]+)'/g;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

export function collectKeys(root = process.cwd()) {
  const keys = new Set();
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(join(root, dir))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(KEY_PATTERN)) keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

export function readPropertyKeys(root = process.cwd()) {
  const text = readFileSync(join(root, 'i18n/default.properties'), 'utf8').replace(/\r\n/g, '\n');
  const keys = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) keys.add(trimmed.slice(0, eq).trim());
  }
  return keys;
}

export function render(keys) {
  const list = keys.map((key) => `  "${key}": /*[[\${#messages.msg('${key}')}]]*/ ""`);
  return [
    '<!--',
    '  由 tools/gen-i18n-dict.mjs 生成，请勿手工修改。',
    '  值来自 i18n/default.properties（按服务端 Locale 解析），脚本用 i18n.js 的 t() 读取。',
    '-->',
    '<script type="application/json" id="nucma-i18n" th:inline="javascript" th:fragment="dict">',
    '{',
    list.join(',\n'),
    '}',
    '</script>',
    '',
  ].join('\n');
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/gen-i18n-dict.mjs');
if (isMain) {
  const root = process.cwd();
  const keys = collectKeys(root);
  const known = readPropertyKeys(root);
  const missing = keys.filter((key) => !known.has(key));
  if (missing.length) {
    console.error(`脚本引用的 key 未在 i18n/default.properties 中定义：\n- ${missing.join('\n- ')}`);
    process.exit(1);
  }
  const content = render(keys);
  const target = join(root, DICT_PATH);
  const check = process.argv.includes('--check');
  const stale = !existsSync(target) || readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== content;
  if (check) {
    if (stale) {
      console.error(`${DICT_PATH} 已过期，请运行 node tools/gen-i18n-dict.mjs`);
      process.exit(1);
    }
    console.log(`i18n 字典最新：${keys.length} 个 key`);
  } else {
    writeFileSync(target, content, 'utf8');
    console.log(`已写入 ${DICT_PATH}：${keys.length} 个 key`);
  }
}
