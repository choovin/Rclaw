/**
 * Persist cloud member tokens in an encrypted electron-store file (AES-256-GCM).
 * Encryption key is derived from a stable machine id + app name so the on-disk
 * blob is not portable to another device by simple file copy. This is weaker than
 * OS keychain integration but avoids native keytar bindings.
 */

import { createHash } from 'crypto';
import { app } from 'electron';
import { machineIdSync } from 'node-machine-id';

export interface CloudAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function deriveEncryptionKey(): Buffer {
  let machineKey: string;
  try {
    machineKey = machineIdSync();
  } catch {
    machineKey = app.getPath('userData');
  }
  return createHash('sha256')
    .update(`ClawX-CloudAuth-v1\0${machineKey}\0${app.getName()}`)
    .digest();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cloudAuthTokenStore: any = null;

export async function getCloudAuthTokenStore() {
  if (!cloudAuthTokenStore) {
    const Store = (await import('electron-store')).default;
    cloudAuthTokenStore = new Store<{ tokens: CloudAuthTokens | null }>({
      name: 'cloud-auth',
      encryptionKey: deriveEncryptionKey(),
      encryptionAlgorithm: 'aes-256-gcm',
      defaults: {
        tokens: null,
      },
    });
  }
  return cloudAuthTokenStore;
}
