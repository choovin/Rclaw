import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expandPath } from './paths';

/** OpenClaw workspace bootstrap: https://docs.openclaw.ai/concepts/agent-workspace */
export const OPENCLAW_USER_FILENAME = 'USER.md';

export interface DigitalEmployeeWorkspacePayload {
  /** 智能体对外使用的姓名（中文） */
  nameZh: string;
  /** 职能/岗位标签，如「人类学家」——对应员工卡片上的 `name` */
  roleTitle: string;
  soulContent: string;
  agentsContent: string;
  /** 目录中的长文案身份介绍，会追加在 IDENTITY 结构化字段之后 */
  identityContent: string;
  emoji?: string;
  vibe?: string;
}

/** IDENTITY.md：描述智能体本人（与 USER.md「人类用户」区分）。 */
export function buildIdentityMd(payload: DigitalEmployeeWorkspacePayload): string {
  const vibeLine = (payload.vibe ?? '').trim() || '（可随对话补充）';
  const emojiLine = (payload.emoji ?? '').trim() || '—';

  const header = `# IDENTITY.md - 我是谁

- Name: ${payload.nameZh}
- Creature: 数字员工（职能角色：${payload.roleTitle}）
- Vibe: ${vibeLine}
- Emoji: ${emojiLine}
- Avatar: （可选：工作区相对路径、https URL 或 data URI）

---
`;

  const extra = payload.identityContent.trim();
  return extra ? `${header}\n${extra}\n` : `${header}\n`;
}

/** USER.md：描述智能体要帮助的真人用户（OpenClaw 约定），不是智能体档案。 */
export function buildUserMdTemplate(): string {
  return `# USER.md - 关于使用本工作区的人类

在与使用者的互动中逐步完善（这是**真人用户**档案，不是智能体本人）。

- Name:
- 如何称呼:
- 代词:（可选）
- 时区:
- 备注:

## 背景与上下文

（对方关心什么、在做哪些项目、偏好与界限——随时间补充。）
`;
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
  writeFileSync(join(absWorkspaceDir, 'IDENTITY.md'), buildIdentityMd(payload), 'utf-8');

  writeFileSync(join(absWorkspaceDir, OPENCLAW_USER_FILENAME), buildUserMdTemplate(), 'utf-8');

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
*由 RClaw 数字员工系统生成*
`;
  writeFileSync(join(absWorkspaceDir, 'TODO.md'), todoContent, 'utf-8');
}

/** Read SOUL.md / AGENTS.md from a provisioned agent workspace. Missing files yield empty strings. */
export async function readWorkspaceSoulAgentsMd(agentId: string): Promise<{
  soulContent: string;
  agentsContent: string;
}> {
  const id = agentId.trim();
  if (!id) throw new Error('agentId must be non-empty');

  const dir = expandPath(`~/.openclaw/workspace-${id}`);
  const soulPath = join(dir, 'SOUL.md');
  const agentsPath = join(dir, 'AGENTS.md');

  const readUtf8 = async (filePath: string): Promise<string> => {
    try {
      return await readFile(filePath, 'utf8');
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return '';
      throw e;
    }
  };

  const [soulContent, agentsContent] = await Promise.all([readUtf8(soulPath), readUtf8(agentsPath)]);
  return { soulContent, agentsContent };
}
