export type SkillhubVersionInfo = {
  id: number;
  version: string;
  status: string;
};

export type SkillhubListItem = {
  id: number;
  slug: string;
  displayName: string;
  summary: string;
  status: string;
  namespace: string;
  updatedAt: string;
  publishedVersion?: SkillhubVersionInfo | null;
  headlineVersion?: SkillhubVersionInfo | null;
  ownerPreviewVersion?: SkillhubVersionInfo | null;
  resolutionMode: string;
  downloadCount?: number;
  starCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  canSubmitPromotion?: boolean;
};

export type SkillhubListResponse = {
  code: number;
  msg: string;
  data: {
    total: number;
    list: SkillhubListItem[];
  };
};
