import { hostApiFetch } from '@/lib/host-api';
import type { SkillhubListResponse } from '@/types/skillhub';

export const PAGE_SIZE = 15;

export function getSkillhubPageSize(): number {
  return PAGE_SIZE;
}

export async function fetchSkillhubPage(q: string, pageNo: number): Promise<SkillhubListResponse> {
  const params = new URLSearchParams();
  params.set('pageNo', String(pageNo));
  params.set('pageSize', String(PAGE_SIZE));
  if (q.trim()) params.set('q', q.trim());
  return hostApiFetch<SkillhubListResponse>(`/api/cloud/skillhub/skills?${params.toString()}`);
}
