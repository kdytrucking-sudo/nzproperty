// scripts/snapshot.mjs
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2025-09-06T15-42-10
const outDir = path.join(process.cwd(), 'backup');
await fs.promises.mkdir(outDir, { recursive: true });

const outName = `backup-${ts}.zip`;
const outPath = path.join(outDir, outName);

const output = fs.createWriteStream(outPath);
const zip = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✅ Snapshot written: ${outName} (${zip.pointer()} bytes)`);
  console.log('👉 在左侧文件树就能看到这个 zip，右键下载保存');
});
zip.on('error', (err) => { throw err; });

zip.pipe(output);

// 打包所有文件，但排除大文件/临时文件/私密文件
zip.glob('**/*', {
  ignore: [
    'node_modules/**',
    '.next/**',
    '.git/**',
    'backup-*.zip',
    '.DS_Store',
    'backup/**',
    'scripts/restore.mjs'
  ]
});

await zip.finalize();