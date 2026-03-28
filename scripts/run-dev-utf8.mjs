/**
 * 开发入口：在 Windows 控制台将代码页设为 UTF-8（65001），避免 Vite/Electron 等输出的中文乱码。
 * 非 Windows 直接启动 Vite。pnpm 会先执行 predev，再执行本脚本（见 package.json）。
 */
import { execSync, spawnSync } from 'node:child_process';
import process from 'node:process';

function setWindowsConsoleUtf8() {
  if (process.platform !== 'win32') return;
  try {
    execSync('chcp 65001', { stdio: 'inherit', shell: true, windowsHide: true });
  } catch {
    // 忽略无控制台等环境
  }
}

setWindowsConsoleUtf8();

const result = spawnSync('pnpm', ['exec', 'vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
  env: { ...process.env },
});

process.exit(result.status ?? 1);
