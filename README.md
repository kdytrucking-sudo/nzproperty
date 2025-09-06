# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.
npm run snapshot
npm run restore -- "backup/backup-YYYYMMDD-...zip"
注意：路径用 /，文件名包含空格就加引号。

2.3 一键恢复“最近一次”备份（免找名字）
LATEST=$(ls -t backup/*.zip | head -n1)
npm run restore -- "$LATEST"
