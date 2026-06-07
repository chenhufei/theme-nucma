#!/usr/bin/env node

/**
 * 主题版本自动更新脚本
 * 用法：node scripts/update-version.js [patch|minor|major]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUMP_TYPE = process.argv[2] || 'patch';
const VALID_TYPES = ['patch', 'minor', 'major'];

if (!VALID_TYPES.includes(BUMP_TYPE)) {
  console.error('❌ 错误：版本类型必须是 patch、minor 或 major');
  process.exit(1);
}

// 文件路径
const PACKAGE_JSON = path.join(__dirname, '../package.json');
const THEME_YAML = path.join(__dirname, '../theme.yaml');

/**
 * 读取当前版本
 */
function getCurrentVersion() {
  const content = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  return content.version;
}

/**
 * 解析版本号
 */
function parseVersion(version) {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2]
  };
}

/**
 * 递增版本号
 */
function bumpVersion(version, type) {
  const parsed = parseVersion(version);

  switch (type) {
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'major':
      return `${parsed.major + 1}.0.0`;
    default:
      return version;
  }
}

/**
 * 更新 package.json
 */
function updatePackageJson(newVersion) {
  const content = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  content.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(content, null, 2) + '\n');
}

/**
 * 更新 theme.yaml
 */
function updateThemeYaml(newVersion) {
  const content = fs.readFileSync(THEME_YAML, 'utf-8');
  const updated = content.replace(/version: "(\d+\.\d+\.\d+)"/, `version: "${newVersion}"`);
  fs.writeFileSync(THEME_YAML, updated);
}

/**
 * 主流程
 */
function main() {
  try {
    console.log('🔄 主题版本自动更新...\n');

    // 获取当前版本
    const currentVersion = getCurrentVersion();
    console.log(`📦 当前版本: ${currentVersion}`);

    // 递增版本
    const newVersion = bumpVersion(currentVersion, BUMP_TYPE);
    console.log(`✨ 新版本: ${newVersion} (${BUMP_TYPE})\n`);

    // 更新文件
    updatePackageJson(newVersion);
    updateThemeYaml(newVersion);

    console.log('✅ 版本更新完成！');
    console.log('💡 现在可以运行 "pnpm build" 来构建主题');

    process.exit(0);
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

main();
