import type { Employee } from '@/types/employee';

/**
 * 会话历史 / 聊天工具条等处的智能体展示名：已关联「我的员工」时用 `nameZh(name)`（中文名 + 职能标签）。
 */
export function formatAgentSessionDisplayName(
  agentId: string,
  fallbackName: string,
  myEmployees: Employee[],
): string {
  const emp = myEmployees.find((e) => e.linkedAgentId === agentId);
  const zh = emp?.nameZh?.trim();
  const role = emp?.name?.trim();
  if (zh && role) {
    return `${zh}(${role})`;
  }
  return fallbackName;
}
