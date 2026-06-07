import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeDir = path.dirname(__dirname);
const srcDir = path.join(themeDir, 'src');
const sourceAssetsDir = path.join(themeDir, 'assets');
const themeAssetsDir = path.join(themeDir, 'templates', 'assets');
const themeAssetsJsDir = path.join(themeAssetsDir, 'js');

const jsFiles = [
  'shortcodes.js',
  'mobile.js',
  'archive-timeline.js',
  'plugin-adapter.js',
  'utils.js',
  'lenis-scroll.js',
  'scroll-animations.js',
  'typewriter.js',
  'theme-enhancements.js',
  'theme-init.js',
  'theme-config.js',
  'theme-shell.js',
  'post-page.js',
  'auth-characters.js',
  'home.js'
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanJsDir() {
  ensureDir(themeAssetsJsDir);
  for (const fileName of fs.readdirSync(themeAssetsJsDir)) {
    if (fileName.endsWith('.js')) {
      fs.rmSync(path.join(themeAssetsJsDir, fileName), { force: true });
    }
  }
}

function copyThemeScripts() {
  for (const fileName of jsFiles) {
    const sourcePath = path.join(srcDir, fileName);
    const targetPath = path.join(themeAssetsJsDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      console.log(`Missing source file: ${sourcePath}`);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${fileName}`);
  }
}

function copyStaticAssetFiles() {
  ensureDir(themeAssetsDir);

  for (const entry of fs.readdirSync(sourceAssetsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;

    const sourcePath = path.join(sourceAssetsDir, entry.name);
    const targetPath = path.join(themeAssetsDir, entry.name);
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied static asset ${entry.name}`);
  }
}

function main() {
  ensureDir(themeAssetsDir);
  cleanJsDir();
  copyThemeScripts();
  copyStaticAssetFiles();
  console.log('Theme assets prepared under templates/assets');
}

main();
