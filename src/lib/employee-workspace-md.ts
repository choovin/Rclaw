import { hostApiFetch } from '@/lib/host-api';

export type WorkspaceMdResponse =
  | { success: true; soulContent: string; agentsContent: string }
  | { success: false; error?: string };

export async function fetchEmployeeWorkspaceMd(linkedAgentId: string): Promise<WorkspaceMdResponse> {
  const q = new URLSearchParams({ linkedAgentId: linkedAgentId.trim() }).toString();
  return hostApiFetch<WorkspaceMdResponse>(`/api/employees/workspace-md?${q}`, { method: 'GET' });
}
