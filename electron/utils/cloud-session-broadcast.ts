import { BrowserWindow } from 'electron';

/** 通知所有 BrowserWindow：云端会话已失效（如 refresh 失败），渲染进程应清除本地登录 UI 状态 */
export function broadcastCloudLoggedOut(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send('cloud:logged-out');
  }
}
