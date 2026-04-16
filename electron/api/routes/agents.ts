import type { IncomingMessage, ServerResponse } from 'http';
import {
  applyAgentSkillAllowlist,
  ensureSlugsViaClawHub,
  normalizeProvisionSkillSlugs,
} from '../../utils/agent-skill-allowlist';
import {
  assignChannelToAgent,
  createAgent,
  clearChannelBinding,
  deleteAgentConfig,
  listAgentsSnapshot,
  provisionDigitalEmployeeAgent,
  removeAgentWorkspaceDirectory,
  resolveAccountIdForAgent,
  updateAgentModel,
  updateAgentName,
  type ProvisionWorkspaceStage,
} from '../../utils/agent-config';
import { deleteChannelAccountConfig } from '../../utils/channel-config';
import { syncAgentModelOverrideToRuntime, syncAllProviderAuthToRuntime } from '../../services/providers/provider-runtime-sync';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

function scheduleGatewayReload(ctx: HostApiContext, reason: string): void {
  if (ctx.gatewayManager.getStatus().state !== 'stopped') {
    ctx.gatewayManager.debouncedReload();
    return;
  }
  void reason;
}

type ProvisionEmitStage = ProvisionWorkspaceStage | 'sync_reload';

function emitProvisionStage(ctx: HostApiContext, stage: ProvisionEmitStage): void {
  try {
    ctx.mainWindow?.webContents.send('employee-provision:stage', { stage });
  } catch (err) {
    console.warn('[agents] employee-provision:stage emit failed:', err);
  }
}

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

/**
 * Force a full Gateway process restart after agent deletion.
 *
 * A SIGUSR1 in-process reload is NOT sufficient here: channel plugins
 * (e.g. Feishu) maintain long-lived WebSocket connections to external
 * services and do not disconnect accounts that were removed from the
 * config during an in-process reload.  The only reliable way to drop
 * stale bot connections is to kill the Gateway process entirely and
 * spawn a fresh one that reads the updated openclaw.json from scratch.
 */
export async function restartGatewayForAgentDeletion(ctx: HostApiContext): Promise<void> {
  try {
    // Capture the PID of the running Gateway BEFORE stop() clears it.
    const status = ctx.gatewayManager.getStatus();
    const pid = status.pid;
    const port = status.port;
    console.log('[agents] Triggering Gateway restart (kill+respawn) after agent deletion', { pid, port });

    // Force-kill the Gateway process by PID.  The manager's stop() only
    // kills "owned" processes; if the manager connected to an already-
    // running Gateway (ownsProcess=false), stop() simply closes the WS
    // and the old process stays alive with its stale channel connections.
    if (pid) {
      try {
        if (process.platform === 'win32') {
          await execAsync(`taskkill /F /PID ${pid} /T`);
        } else {
          process.kill(pid, 'SIGTERM');
          // Give it a moment to die
          await new Promise((resolve) => setTimeout(resolve, 500));
          try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
        }
      } catch {
        // process already gone – that's fine
      }
    } else if (port) {
      // If we don't know the PID (e.g. connected to an orphaned Gateway from
      // a previous pnpm dev run), forcefully kill whatever is on the port.
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          // MUST use -sTCP:LISTEN. Otherwise lsof returns the client process (ClawX itself) 
          // that has an ESTABLISHED WebSocket connection to the port, causing us to kill ourselves.
          const { stdout } = await execAsync(`lsof -t -i :${port} -sTCP:LISTEN`);
          const pids = stdout.trim().split('\n').filter(Boolean);
          for (const p of pids) {
            try { process.kill(parseInt(p, 10), 'SIGTERM'); } catch { /* ignore */ }
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          for (const p of pids) {
            try { process.kill(parseInt(p, 10), 'SIGKILL'); } catch { /* ignore */ }
          }
        } else if (process.platform === 'win32') {
          // Find PID listening on the port
          const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
          const lines = stdout.trim().split('\n');
          const pids = new Set<string>();
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
              pids.add(parts[4]);
            }
          }
          for (const p of pids) {
            try { await execAsync(`taskkill /F /PID ${p} /T`); } catch { /* ignore */ }
          }
        }
      } catch {
        // Port might not be bound or command failed; ignore
      }
    }

    await ctx.gatewayManager.restart();
    console.log('[agents] Gateway restart completed after agent deletion');
  } catch (err) {
    console.warn('[agents] Gateway restart after agent deletion failed:', err);
  }
}

export async function handleAgentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/agents' && req.method === 'GET') {
    sendJson(res, 200, { success: true, ...(await listAgentsSnapshot()) });
    return true;
  }

  if (url.pathname === '/api/agents' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ name: string; inheritWorkspace?: boolean }>(req);
      if (typeof body.name !== 'string') {
        sendJson(res, 400, { success: false, error: 'name is required (string)' });
        return true;
      }

      const snapshot = await createAgent(body.name, { inheritWorkspace: Boolean(body.inheritWorkspace) });

      // Ensure runtime provider auth registry is up-to-date for newly created agent workspaces.
      syncAllProviderAuthToRuntime().catch((syncError) => {
        console.warn('[agents] Failed to sync provider auth after agent creation:', syncError);
      });

      scheduleGatewayReload(ctx, 'create-agent');
      sendJson(res, 200, { success: true, ...snapshot });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/agents/') && req.method === 'PUT') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 1) {
      try {
        const body = await parseJsonBody<{ name: string }>(req);
        const agentId = decodeURIComponent(parts[0]);
        const snapshot = await updateAgentName(agentId, body.name);
        scheduleGatewayReload(ctx, 'update-agent');
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 2 && parts[1] === 'model') {
      try {
        const body = await parseJsonBody<{ modelRef?: string | null }>(req);
        const agentId = decodeURIComponent(parts[0]);
        const snapshot = await updateAgentModel(agentId, body.modelRef ?? null);
        try {
          await syncAllProviderAuthToRuntime();
          // Ensure this agent's runtime model registry reflects the new model override.
          await syncAgentModelOverrideToRuntime(agentId);
        } catch (syncError) {
          console.warn('[agents] Failed to sync runtime after updating agent model:', syncError);
        }
        scheduleGatewayReload(ctx, 'update-agent-model');
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'channels') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const channelType = decodeURIComponent(parts[2]);
        const snapshot = await assignChannelToAgent(agentId, channelType);
        scheduleGatewayReload(ctx, 'assign-channel');
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  if (url.pathname.startsWith('/api/agents/') && req.method === 'DELETE') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 1) {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const { snapshot, removedEntry } = await deleteAgentConfig(agentId);
        // Await reload synchronously BEFORE responding to the client.
        // This ensures the Feishu plugin has disconnected the deleted bot
        // before the UI shows "delete success" and the user tries chatting.
        await restartGatewayForAgentDeletion(ctx);
        // Delete workspace after reload so the new config is already live.
        await removeAgentWorkspaceDirectory(removedEntry).catch((err) => {
          console.warn('[agents] Failed to remove workspace after agent deletion:', err);
        });
        // Extra in-process reload hint so any attached supervisor picks up openclaw.json
        // without relying solely on the kill+respawn path above.
        scheduleGatewayReload(ctx, 'delete-agent');
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'channels') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const channelType = decodeURIComponent(parts[2]);
        const ownerId = agentId.trim().toLowerCase();
        const snapshotBefore = await listAgentsSnapshot();
        const ownedAccountIds = Object.entries(snapshotBefore.channelAccountOwners)
          .filter(([channelAccountKey, owner]) => {
            if (owner !== ownerId) return false;
            return channelAccountKey.startsWith(`${channelType}:`);
          })
          .map(([channelAccountKey]) => channelAccountKey.slice(channelAccountKey.indexOf(':') + 1));
        // Backward compatibility for legacy agentId->accountId mapping.
        if (ownedAccountIds.length === 0) {
          const legacyAccountId = resolveAccountIdForAgent(agentId);
          if (snapshotBefore.channelAccountOwners[`${channelType}:${legacyAccountId}`] === ownerId) {
            ownedAccountIds.push(legacyAccountId);
          }
        }

        for (const accountId of ownedAccountIds) {
          await deleteChannelAccountConfig(channelType, accountId);
          await clearChannelBinding(channelType, accountId);
        }
        const snapshot = await listAgentsSnapshot();
        scheduleGatewayReload(ctx, 'remove-agent-channel');
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  // POST /api/employees/provision — create Agent, write MD into real workspace, sync + reload
  if (url.pathname === '/api/employees/provision' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        employeeId: string;
        nameZh: string;
        nameEn: string;
        soulContent: string;
        agentsContent: string;
        identityContent: string;
        emoji?: string;
        vibe?: string;
        skills?: string[];
      }>(req);

      const mustTrimNonEmpty = (value: unknown, fieldName: string): string => {
        if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`);
        const trimmed = value.trim();
        if (!trimmed) throw new Error(`${fieldName} must be non-empty (trimmed)`);
        return trimmed;
      };

      const employeeId = mustTrimNonEmpty(body.employeeId, 'employeeId');
      const nameZh = mustTrimNonEmpty(body.nameZh, 'nameZh');
      const nameEn = mustTrimNonEmpty(body.nameEn, 'nameEn');

      if (typeof body.soulContent !== 'string') throw new Error('soulContent must be a string');
      if (!body.soulContent.trim()) throw new Error('soulContent must be non-empty (trimmed)');
      const soulContent = body.soulContent;

      if (typeof body.agentsContent !== 'string') throw new Error('agentsContent must be a string');
      if (!body.agentsContent.trim()) throw new Error('agentsContent must be non-empty (trimmed)');
      const agentsContent = body.agentsContent;

      let vibe: string | undefined;
      if (body.vibe !== undefined && body.vibe !== null) {
        if (typeof body.vibe !== 'string') throw new Error('vibe must be a string');
        const vibeTrimmed = body.vibe.trim();
        vibe = vibeTrimmed.length > 0 ? vibeTrimmed : undefined;
      }

      const identityContent =
        typeof body.identityContent === 'string' ? body.identityContent : '';

      if (body.skills !== undefined && body.skills !== null) {
        if (!Array.isArray(body.skills)) {
          throw new Error('skills must be an array');
        }
        for (const s of body.skills) {
          if (typeof s !== 'string') {
            throw new Error('skills must be an array of strings');
          }
        }
      }

      const result = await provisionDigitalEmployeeAgent(
        {
          nameZh,
          nameEn,
          soulContent,
          agentsContent,
          identityContent,
          emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
          vibe,
        },
        (stage) => emitProvisionStage(ctx, stage),
      );

      const requested = normalizeProvisionSkillSlugs(body.skills);
      if (requested.length > 0) {
        const resolved = await ensureSlugsViaClawHub(requested, ctx.clawHubService, {
          employeeId,
          agentId: result.agentId,
        });
        if (resolved.length > 0) {
          await applyAgentSkillAllowlist(result.agentId, resolved);
        } else {
          await applyAgentSkillAllowlist(result.agentId, null);
          console.warn('[agents] All skill slugs failed to install; agent inherits default skill policy', {
            employeeId,
            agentId: result.agentId,
          });
        }
      }

      emitProvisionStage(ctx, 'sync_reload');
      syncAllProviderAuthToRuntime().catch((err) => {
        console.warn('[agents] Failed to sync provider auth after employee provision:', err);
      });
      scheduleGatewayReload(ctx, 'provision-employee');

      sendJson(res, 200, {
        success: true,
        agentId: result.agentId,
        workspacePath: result.workspacePath,
        employeeId,
      });
    } catch (error) {
      const err = error as Error & { agentId?: string };
      console.error('[agents] POST /api/employees/provision failed:', error);
      const msg = String(error);
      const isValidationError =
        /must be a string|must be non-empty \(trimmed\)/i.test(msg) && !err.agentId;
      sendJson(res, isValidationError ? 400 : 500, {
        success: false,
        error: msg,
        agentId: err.agentId,
      });
    }
    return true;
  }

  return false;
}
