import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeDir = path.dirname(__dirname);

const includeFiles = [
  'theme.yaml',
  'settings.yaml',
  'templates',
  'i18n',
  'LICENSE',
  'README.md'
];

function readThemeVersion() {
  const themeYaml = fs.readFileSync(path.join(themeDir, 'theme.yaml'), 'utf8');
  const match = themeYaml.match(/version:\s*"([^"]+)"/);
  return match ? match[1] : '1.0.0';
}

function addDirWithVersion(archive, srcDir, destName, version) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const zipPath = destName ? `${destName}/${entry.name}` : entry.name;

    if (zipPath === 'templates/assets' || zipPath.startsWith('templates/assets/')) {
      continue;
    }

    if (entry.isDirectory()) {
      addDirWithVersion(archive, srcPath, zipPath, version);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = content.replace(/\{VERSION\}/g, version);
      archive.append(content, { name: zipPath });
      console.log(`Added template ${zipPath}`);
      continue;
    }

    archive.file(srcPath, { name: zipPath });
  }
}

function addStaticDir(archive, srcDir, destName) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const zipPath = destName ? `${destName}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      addStaticDir(archive, srcPath, zipPath);
      continue;
    }

    archive.file(srcPath, { name: zipPath });
    console.log(`Added static file ${zipPath}`);
  }
}

async function createPackage(version) {
  const distDir = path.join(themeDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const outputPath = path.join(distDir, `theme-nucma-${version}.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const file of includeFiles) {
      const filePath = path.join(themeDir, file);
      if (!fs.existsSync(filePath)) continue;

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        addDirWithVersion(archive, filePath, file, version);
        console.log(`Added directory ${file}`);
      } else {
        archive.file(filePath, { name: file });
        console.log(`Added file ${file}`);
      }
    }

    const themeAssetsPath = path.join(themeDir, 'templates', 'assets');
    if (fs.existsSync(themeAssetsPath)) {
      addStaticDir(archive, themeAssetsPath, 'templates/assets');
      console.log('Added directory templates/assets');
    }

    archive.finalize();
  });

  console.log(`Created package ${outputPath}`);
}

createPackage(readThemeVersion()).catch((error) => {
  console.error(error);
  process.exit(1);
});
