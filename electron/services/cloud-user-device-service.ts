import { app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import * as os from 'os';
import { cloudAuthService } from './cloud-auth';
import {
  clearCloudUserDevicePersisted,
  getCloudUserDevicePersisted,
  setCloudUserDevicePersisted,
} from './cloud-user-device-store';
import { cloudFetchLogged } from '../utils/cloud-fetch-log';
import { getCloudApiBaseUrl } from '../utils/cloud-config';
import { logger } from '../utils/logger';
import { getSetting, setSetting } from '../utils/store';
import {
  computeDeviceFingerprint,
  nextHeartbeatFailureState,
  parseClawUserDeviceRegisterJson,
} from '../utils/cloud-user-device-helpers';

const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const REGISTER_RETRY_MAX_ATTEMPTS = 3;
const REGISTER_RETRY_DELAY_MS = 45_000;
const FINGERPRINT_SALT = 'rclaw-claw-user-device-v1';
const DEVICE_REGISTER_PATH = '/app-api/claw/user/device/register';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CloudUserDeviceService {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveHeartbeatFailures = 0;
  private lifecycleStarted = false;

  /** 登录成功后再次登记（不阻塞 IPC） */
  afterMemberLogin(): void {
    if (process.env.CLAWX_E2E === '1') return;
    void this.registerWithRetries().catch((err) => {
      logger.warn('[CloudUserDevice] register after login failed:', err);
    });
  }

  start(): void {
    if (process.env.CLAWX_E2E === '1') return;
    if (this.lifecycleStarted) return;
    this.lifecycleStarted = true;

    void this.runStartup().catch((err) => {
      logger.warn('[CloudUserDevice] startup failed:', err);
      this.lifecycleStarted = false;
    });
  }

  stop(): void {
    this.lifecycleStarted = false;
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.consecutiveHeartbeatFailures = 0;
  }

  private async runStartup(): Promise<void> {
    // 先挂心跳，避免注册重试（最多约 2×45s+）拖后才创建定时器；登记失败不影响此调度
    this.heartbeatTimer = setInterval(() => {
      void this.tickHeartbeat().catch((err) => {
        logger.warn('[CloudUserDevice] heartbeat tick failed:', err);
      });
    }, HEARTBEAT_INTERVAL_MS);

    try {
      await this.registerWithRetries();
    } catch (err) {
      logger.warn('[CloudUserDevice] initial register failed:', err);
    }
  }

  private async ensureMachineId(): Promise<void> {
    let mid = await getSetting('machineId');
    if (!mid) {
      mid = machineIdSync();
      await setSetting('machineId', mid);
      logger.debug('[CloudUserDevice] generated machineId for device register');
    }
  }

  private async registerWithRetries(): Promise<void> {
    for (let attempt = 0; attempt < REGISTER_RETRY_MAX_ATTEMPTS; attempt++) {
      const ok = await this.tryRegisterOnce();
      if (ok) return;
      if (attempt < REGISTER_RETRY_MAX_ATTEMPTS - 1) {
        await delay(REGISTER_RETRY_DELAY_MS);
      }
    }
    logger.warn('[CloudUserDevice] register exhausted retries; clearing persisted server device id');
    await clearCloudUserDevicePersisted();
    this.consecutiveHeartbeatFailures = 0;
  }

  private async tryRegisterOnce(): Promise<boolean> {
    try {
      await this.ensureMachineId();
      const machineId = await getSetting('machineId');
      if (!machineId) return false;

      const base = getCloudApiBaseUrl();
      const url = `${base}${DEVICE_REGISTER_PATH}`;
      const tokenData = await cloudAuthService.getValidToken();

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenData) {
        headers.Authorization = `Bearer ${tokenData.accessToken}`;
      }

      const body = {
        deviceId: machineId,
        deviceName: os.hostname(),
        fingerprint: computeDeviceFingerprint(machineId, FINGERPRINT_SALT),
        platform: process.platform,
        osVersion: os.release(),
        appVersion: app.getVersion(),
      };

      const response = await cloudFetchLogged('claw.user.device:register', url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        return false;
      }

      const parsed = parseClawUserDeviceRegisterJson(raw);
      if (!parsed.ok) return false;

      await setCloudUserDevicePersisted({ serverDeviceId: parsed.id });
      return true;
    } catch (error) {
      logger.warn('[CloudUserDevice] register attempt error:', error);
      return false;
    }
  }

  private async tickHeartbeat(): Promise<void> {
    const persisted = await getCloudUserDevicePersisted();
    if (persisted.serverDeviceId == null) {
      await this.registerWithRetries();
      return;
    }

    const base = getCloudApiBaseUrl();
    const url = `${base}/app-api/claw/user/device/${persisted.serverDeviceId}/heartbeat`;
    const tokenData = await cloudAuthService.getValidToken();

    const headers: Record<string, string> = {};
    if (tokenData) {
      headers.Authorization = `Bearer ${tokenData.accessToken}`;
    }

    let httpStatus = 0;
    let businessCode: unknown = undefined;

    try {
      const response = await cloudFetchLogged('claw.user.device:heartbeat', url, {
        method: 'PUT',
        headers,
      });
      httpStatus = response.status;
      const text = await response.text();
      try {
        const j = JSON.parse(text) as Record<string, unknown>;
        businessCode = j.code;
      } catch {
        if (httpStatus >= 200 && httpStatus < 300) {
          businessCode = 0;
        }
      }
    } catch {
      // httpStatus 保持 0，表示请求未拿到有效 HTTP 响应
    }

    const decision = nextHeartbeatFailureState({
      consecutiveFailures: this.consecutiveHeartbeatFailures,
      httpStatus,
      businessCode,
    });

    if (decision.action === 'reset') {
      this.consecutiveHeartbeatFailures = 0;
      return;
    }

    if (decision.action === 'increment') {
      this.consecutiveHeartbeatFailures = decision.consecutiveFailures;
      return;
    }

    this.consecutiveHeartbeatFailures = 0;
    await clearCloudUserDevicePersisted();
    await this.registerWithRetries();
  }
}

export const cloudUserDeviceService = new CloudUserDeviceService();
