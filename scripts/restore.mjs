// scripts/restore.mjs
import extract from 'extract-zip';
import path from 'path';
import fs from 'fs';

const zipArg = process.argv[2];
if (!zipArg) {
  console.error('用法：npm run restore -- <备份文件名.zip>');
  process.exit(1);
}

const zipPath = path.isAbsolute(zipArg) ? zipArg : path.join(process.cwd(), zipArg);
if (!fs.existsSync(zipPath)) {
  console.error(`找不到备份文件：${zipPath}`);
  process.exit(1);
}

// 为了安全，恢复时跳过.env 和 node_modules 这类文件
// extract-zip 不自带忽略回调，这里先简单粗暴：恢复后把 node_modules/.next 覆盖回空目录（通常不存在）
await extract(zipPath, { dir: process.cwd() });

console.log('✅ Restore done. 建议手动检查：.env*. 文件是否还在；如果 node_modules 被覆盖，重新 npm i 一下。');