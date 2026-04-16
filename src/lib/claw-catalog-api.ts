import { hostApiFetch } from '@/lib/host-api';
import type {
  ClawCatalogAgentDetailResponse,
  ClawCatalogAgentsResponse,
  ClawCatalogDepartmentsResponse,
} from '@/types/claw-catalog';

export const CLAW_CATALOG_PAGE_SIZE = 20;

export async function fetchClawCatalogDepartments(): Promise<ClawCatalogDepartmentsResponse> {
  return hostApiFetch<ClawCatalogDepartmentsResponse>('/api/cloud/claw/catalog/departments');
}

export async function fetchClawCatalogAgents(params: {
  pageNo: number;
  pageSize?: number;
  keyword?: string;
  departmentId?: number;
  tier?: string;
}): Promise<ClawCatalogAgentsResponse> {
  const q = new URLSearchParams();
  q.set('pageNo', String(params.pageNo));
  q.set('pageSize', String(params.pageSize ?? CLAW_CATALOG_PAGE_SIZE));
  if (params.keyword?.trim()) q.set('keyword', params.keyword.trim());
  if (params.departmentId != null) q.set('departmentId', String(params.departmentId));
  if (params.tier?.trim()) q.set('tier', params.tier.trim());
  return hostApiFetch<ClawCatalogAgentsResponse>(`/api/cloud/claw/catalog/agents?${q.toString()}`);
}

export async function fetchClawCatalogAgentDetail(bundleId: string): Promise<ClawCatalogAgentDetailResponse> {
  const id = encodeURIComponent(bundleId.trim());
  return hostApiFetch<ClawCatalogAgentDetailResponse>(`/api/cloud/claw/catalog/agent/${id}`);
}
