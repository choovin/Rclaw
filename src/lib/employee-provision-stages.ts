/**
 * Maps main-process provision stages (Host API + IPC) to AddProgress step indices.
 */
export const PROVISION_STAGE_ORDER = [
  'create_agent',
  'write_files',
  'verify',
  'sync_reload',
] as const;

export function provisionStageToIndex(stage: string): number {
  const i = (PROVISION_STAGE_ORDER as readonly string[]).indexOf(stage);
  return i >= 0 ? i : 0;
}
