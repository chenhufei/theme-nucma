// 安装包「内容摘要」：解压后按路径排序，把 路径 + 每个文件的 sha256 再哈希一次。
//
// 为什么不直接比 zip 的 md5：archiver 的条目顺序取决于 glob 展开顺序，Windows 上同一份
// 内容两次打包可能顺序不同，zip 字节跟着变，md5 也就不可复现。但「包里的文件与内容」
// 是确定的，所以用内容摘要作为「线上资产 == 本地包」的判据。
//
// 用法：node tools/zip-digest.mjs dist/theme-nucma-0.0.4.zip

import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function zipContentDigest(zipPath) {
  if (!existsSync(zipPath)) throw new Error(`安装包不存在：${zipPath}`);

  const zip = new AdmZip(zipPath);
  const entries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      name: entry.entryName.replaceAll('\\', '/'),
      data: entry.getData(),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  if (!entries.length) throw new Error('安装包里没有文件');

  const digest = createHash('sha256');
  for (const entry of entries) {
    digest.update(entry.name);
    digest.update('\0');
    digest.update(createHash('sha256').update(entry.data).digest());
    digest.update('\0');
  }

  return { digest: digest.digest('hex'), files: entries.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const target = process.argv[2];
  if (!target) {
    console.error('用法：node tools/zip-digest.mjs <安装包路径>');
    process.exit(1);
  }
  try {
    const { digest, files } = zipContentDigest(target);
    console.log(`${digest}  ${files} 个文件  ${target}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
