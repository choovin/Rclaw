export function getSkillHubSkillPageUrl(slug: string): string | null {
  const raw = import.meta.env.VITE_SKILL_HUB_BASE_URL?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/+$/, '');
  const path = `/skills/${encodeURIComponent(slug)}`;
  return `${base}${path}`;
}
