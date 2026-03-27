import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DigitalEmployeeWorkspacePayload {
  nameZh: string;
  nameEn: string;
  soulContent: string;
  agentsContent: string;
  identityContent: string;
}

export function writeDigitalEmployeeWorkspaceFiles(
  absWorkspaceDir: string,
  payload: DigitalEmployeeWorkspacePayload,
): void {
  mkdirSync(absWorkspaceDir, { recursive: true });

  if (payload.soulContent) {
    writeFileSync(join(absWorkspaceDir, 'SOUL.md'), payload.soulContent, 'utf-8');
  }
  if (payload.agentsContent) {
    writeFileSync(join(absWorkspaceDir, 'AGENTS.md'), payload.agentsContent, 'utf-8');
  }
  if (payload.identityContent) {
    writeFileSync(join(absWorkspaceDir, 'IDENTITY.md'), payload.identityContent, 'utf-8');
  }

  const userContent = `# 👤 我的资料

## 基本信息
- **名字**：${payload.nameZh}
- **英文名**：${payload.nameEn}
- **角色**：数字员工

## 我擅长的
<!-- 从员工技能中提取 -->

## 我的工作风格
<!-- 从员工人设中提取 -->

## 当前项目
<!-- 记录当前正在处理的项目 -->

## 常用工具
<!-- 记录常用的工具和命令 -->

---
*由 Rclaw 数字员工系统生成*
`;
  writeFileSync(join(absWorkspaceDir, 'user.md'), userContent, 'utf-8');

  const todoContent = `# 📋 待办事项

## 今日任务
- [ ]

## 本周目标
- [ ]

## 进行中的项目
<!-- 记录正在进行的项目 -->

## 已完成
- [ ]

---
*由 Rclaw 数字员工系统生成*
`;
  writeFileSync(join(absWorkspaceDir, 'todo.md'), todoContent, 'utf-8');
}
