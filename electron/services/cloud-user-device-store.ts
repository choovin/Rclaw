export interface CloudUserDevicePersisted {
  serverDeviceId: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storeInstance: any = null;

async function getStore() {
  if (!storeInstance) {
    const Store = (await import('electron-store')).default;
    storeInstance = new Store<CloudUserDevicePersisted>({
      name: 'cloud-user-device',
      defaults: { serverDeviceId: null },
    });
  }
  return storeInstance;
}

export async function getCloudUserDevicePersisted(): Promise<CloudUserDevicePersisted> {
  const s = await getStore();
  return {
    serverDeviceId: s.get('serverDeviceId') ?? null,
  };
}

export async function setCloudUserDevicePersisted(p: CloudUserDevicePersisted): Promise<void> {
  const s = await getStore();
  s.set('serverDeviceId', p.serverDeviceId);
}

export async function clearCloudUserDevicePersisted(): Promise<void> {
  await setCloudUserDevicePersisted({ serverDeviceId: null });
}

/** 供单测重置 store 单例 */
export function __resetCloudUserDeviceStoreForTests(): void {
  storeInstance = null;
}
