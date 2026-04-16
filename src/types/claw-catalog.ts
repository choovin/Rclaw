/**
 * RunNode Claw Catalog API response shapes (see docs/api-docs / temp/claw-catalog-*.md).
 */

export interface ClawCatalogDepartment {
  id: number;
  department: string;
  departmentNameZh: string;
  logo: string | null;
  parentId: number;
  sort: number;
  children: ClawCatalogDepartment[] | null;
  createTime: number;
  updateTime: number;
}

export interface ClawCatalogAgent {
  id: number;
  bundleId: string;
  version: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  avatar: string;
  systemPrompt: string;
  requiredSkills: string;
  requiredChannels: string;
  scenario: string | null;
  tags: string;
  tier: string;
  permissionProfile: string;
  isOfficial: number;
  status: number;
  downloadCount: number;
  rating: number;
  createTime: number;
  updateTime: number;
  departmentId: number;
  department: string;
  departmentNameZh: string;
  color: string;
  emoji: string;
  vibe: string;
  vibeZh: string;
  soulContent: string;
  agentsContent: string;
  identityContent: string;
}

export interface ClawCatalogDepartmentsResponse {
  code: number;
  msg: string;
  data: ClawCatalogDepartment[];
}

export interface ClawCatalogAgentsResponse {
  code: number;
  msg: string;
  data: {
    total: number;
    list: ClawCatalogAgent[];
  };
}

export interface ClawCatalogAgentDetailResponse {
  code: number;
  msg: string;
  data: ClawCatalogAgent;
}
