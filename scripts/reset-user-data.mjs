#!/usr/bin/env node
/**
 * 删除本应用的 Electron userData 目录，用于本地测试「首次打开 → Setup 向导」等场景。
 *
 * 使用前请完全退出 RClaw（含托盘），否则可能删不干净或损坏正在写入的文件。
 *
 * 用法:
 *   pnpm run reset:user-data
 *   pnpm run reset:user-data -- --yes
 *   pnpm run reset:user-data -- --dir "C:\\path\\to\\custom-user-data"
 *
 * 与 E2E 一致：若你用 CLAWX_E2E=1 + CLAWX_USER_DATA_DIR 启动，可对同一目录执行
 *   pnpm run reset:user-data -- --dir "%CLAWX_USER_DATA_DIR%"
 */
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readAppNameFromPackageJson() {
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (typeof pkg.name !== 'string' || !pkg.name.trim()) {
    throw new Error('package.json 缺少有效的 name 字段');
  }
  return pkg.name.trim();
}

function defaultElectronUserDataDir(appName) {
  const os = platform();
  if (os === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error('未设置 APPDATA，无法解析 Windows 下的 userData 路径');
    }
    return join(appData, appName);
  }
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName);
  }
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(configHome, appName);
}

function parseArgs(argv) {
  let yes = false;
  let dir = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') {
      yes = true;
      continue;
    }
    if (a === '--dir' || a === '-d') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('--dir 需要后跟目录路径');
      }
      dir = next;
      i += 1;
      continue;
    }
    if (a.startsWith('--dir=')) {
      dir = a.slice('--dir='.length);
      continue;
    }
  }
  return { yes, dir };
}

async function main() {
  const argv = process.argv.slice(2);
  const { yes, dir: dirArg } = parseArgs(argv);
  const appName = readAppNameFromPackageJson();
  const targetDir = (dirArg && dirArg.trim()) || defaultElectronUserDataDir(appName);

  console.log(`将删除应用数据目录（等价于全新安装后的首次启动）：\n  ${targetDir}\n`);
  console.log('其中包含：主进程 settings / 云登录与 Provider / 窗口状态、设备标识、日志，以及渲染进程 localStorage（含 setup 完成标记）等。\n');

  if (!existsSync(targetDir)) {
    console.log('目录不存在，无需清理。');
    process.exit(0);
  }

  if (!yes) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('确认删除？输入 yes 继续，其它键退出: ');
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('已取消。');
      process.exit(1);
    }
  }

  try {
    rmSync(targetDir, { recursive: true, force: true });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
    if (code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY') {
      console.error(
        '删除失败：目录被占用。请完全退出 RClaw（含系统托盘），必要时在任务管理器中结束进程后重试。',
      );
      process.exit(1);
    }
    throw err;
  }
  console.log('已清空。请重新启动应用以进入 Setup 向导。');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
