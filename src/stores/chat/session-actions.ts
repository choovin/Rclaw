import { invokeIpc } from '@/lib/api-client';
import { isCronSessionKey } from './cron-session-utils';
import { getCanonicalPrefixFromSessions, getMessageText, toMs } from './helpers';
import { maxRawMessageTimestampMs } from './message-time';
import { fetchDiskLastActivityBySessionKeys } from './session-disk-activity';
import { classifyHistoryStartupRetryError, sleep } from './history-startup-retry';
import { DEFAULT_CANONICAL_PREFIX, DEFAULT_SESSION_KEY, type ChatSession, type RawMessage } from './types';
import type { ChatGet, ChatSet, SessionHistoryActions } from './store-api';

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

function parseSessionUpdatedAtMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return toMs(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export function createSessionActions(
  set: ChatSet,
  get: ChatGet,
): Pick<SessionHistoryActions, 'loadSessions' | 'switchSession' | 'newSession' | 'deleteSession' | 'cleanupEmptySession'> {
  return {
    loadSessions: async () => {
      try {
        const result = await invokeIpc(
          'gateway:rpc',
          'sessions.list',
          {}
        ) as { success: boolean; result?: Record<string, unknown>; error?: string };

        if (result.success && result.result) {
          const data = result.result;
          const rawSessions = Array.isArray(data.sessions) ? data.sessions : [];
          const sessions: ChatSession[] = rawSessions.map((s: Record<string, unknown>) => ({
            key: String(s.key || ''),
            label: s.label ? String(s.label) : undefined,
            displayName: s.displayName ? String(s.displayName) : undefined,
            thinkingLevel: s.thinkingLevel ? String(s.thinkingLevel) : undefined,
            model: s.model ? String(s.model) : undefined,
            updatedAt: parseSessionUpdatedAtMs(s.updatedAt),
          })).filter((s: ChatSession) => s.key);

          const canonicalBySuffix = new Map<string, string>();
          for (const session of sessions) {
            if (!session.key.startsWith('agent:')) continue;
            const parts = session.key.split(':');
            if (parts.length < 3) continue;
            const suffix = parts.slice(2).join(':');
            if (suffix && !canonicalBySuffix.has(suffix)) {
              canonicalBySuffix.set(suffix, session.key);
            }
          }

          // Deduplicate: if both short and canonical existed, keep canonical only
          const seen = new Set<string>();
          const dedupedSessions = sessions.filter((s) => {
            if (!s.key.startsWith('agent:') && canonicalBySuffix.has(s.key)) return false;
            if (seen.has(s.key)) return false;
            seen.add(s.key);
            return true;
          });

          const { currentSessionKey } = get();
          let nextSessionKey = currentSessionKey || DEFAULT_SESSION_KEY;
          if (!nextSessionKey.startsWith('agent:')) {
            const canonicalMatch = canonicalBySuffix.get(nextSessionKey);
            if (canonicalMatch) {
              nextSessionKey = canonicalMatch;
            }
          }
          if (!dedupedSessions.find((s) => s.key === nextSessionKey) && dedupedSessions.length > 0) {
            // Current session not found in the backend list
            const isNewEmptySession = get().messages.length === 0;
            if (!isNewEmptySession) {
              nextSessionKey = dedupedSessions[0].key;
            }
          }

          const sessionsWithCurrent = !dedupedSessions.find((s) => s.key === nextSessionKey) && nextSessionKey
            ? [
              ...dedupedSessions,
              { key: nextSessionKey, displayName: nextSessionKey },
            ]
            : dedupedSessions;

          const discoveredActivity = Object.fromEntries(
            sessionsWithCurrent
              .filter((session) => typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt))
              .map((session) => [session.key, session.updatedAt!]),
          );

          const loadGatewayHydration = async (): Promise<{
            activity: Record<string, number>;
            labels: Record<string, string>;
          }> => {
            const activity: Record<string, number> = {};
            const labels: Record<string, string> = {};
            const targets = sessionsWithCurrent.filter((s) => !isCronSessionKey(s.key));
            if (targets.length === 0) return { activity, labels };

            const LABEL_RETRY_DELAYS = [2_000, 5_000, 10_000];
            let pending = targets;
            for (let attempt = 0; attempt <= LABEL_RETRY_DELAYS.length; attempt += 1) {
              const failed: typeof pending = [];
              await Promise.all(
                pending.map(async (session) => {
                  try {
                    const r = await invokeIpc(
                      'gateway:rpc',
                      'chat.history',
                      { sessionKey: session.key, limit: 1000 },
                    ) as { success: boolean; result?: Record<string, unknown>; error?: string };
                    if (!r.success) {
                      if (classifyHistoryStartupRetryError(r.error) === 'gateway_startup') {
                        failed.push(session);
                      }
                      return;
                    }
                    if (!r.result) return;
                    const msgs = Array.isArray(r.result.messages) ? r.result.messages as RawMessage[] : [];
                    const firstUser = msgs.find((m) => m.role === 'user');
                    if (firstUser && !session.key.endsWith(':main')) {
                      const labelText = getMessageText(firstUser.content).trim();
                      if (labelText) {
                        labels[session.key] = labelText.length > 50 ? `${labelText.slice(0, 50)}…` : labelText;
                      }
                    }
                    const maxMs = maxRawMessageTimestampMs(msgs);
                    if (maxMs != null) {
                      activity[session.key] = maxMs;
                    }
                  } catch (err) {
                    if (classifyHistoryStartupRetryError(err) === 'gateway_startup') {
                      failed.push(session);
                    }
                  }
                }),
              );
              if (failed.length === 0 || attempt >= LABEL_RETRY_DELAYS.length) break;
              await sleep(LABEL_RETRY_DELAYS[attempt]!);
              pending = failed;
            }
            return { activity, labels };
          };

          const [diskActivity, hydrated] = await Promise.all([
            fetchDiskLastActivityBySessionKeys(sessionsWithCurrent.map((s) => s.key)),
            loadGatewayHydration(),
          ]);

          const hydratedActivity = hydrated.activity;
          const hydratedLabels = hydrated.labels;

          set((state) => {
            const mergedSessionLastActivity: Record<string, number> = { ...state.sessionLastActivity };
            for (const session of sessionsWithCurrent) {
              const k = session.key;
              const candidates: number[] = [];
              const d = discoveredActivity[k];
              const h = hydratedActivity[k];
              const disk = diskActivity[k];
              const prev = mergedSessionLastActivity[k];
              if (typeof d === 'number' && Number.isFinite(d)) candidates.push(d);
              if (typeof h === 'number' && Number.isFinite(h)) candidates.push(h);
              if (typeof disk === 'number' && Number.isFinite(disk)) candidates.push(disk);
              if (typeof prev === 'number' && Number.isFinite(prev)) candidates.push(prev);
              if (candidates.length === 0) continue;
              mergedSessionLastActivity[k] = Math.max(...candidates);
            }
            return {
              sessions: sessionsWithCurrent,
              currentSessionKey: nextSessionKey,
              currentAgentId: getAgentIdFromSessionKey(nextSessionKey),
              sessionLastActivity: mergedSessionLastActivity,
              sessionLabels: { ...state.sessionLabels, ...hydratedLabels },
            };
          });

          if (currentSessionKey !== nextSessionKey) {
            get().loadHistory();
          }
        }
      } catch (err) {
        console.warn('Failed to load sessions:', err);
      }
    },

    // ── Switch session ──

    switchSession: (key: string) => {
      const { currentSessionKey, messages, sessionLastActivity, sessionLabels } = get();
      // Only treat sessions with no history records and no activity timestamp as empty.
      // Relying solely on messages.length is unreliable because switchSession clears
      // the current messages before loadHistory runs, creating a race condition that
      // could cause sessions with real history to be incorrectly removed from the sidebar.
      const leavingEmpty = !currentSessionKey.endsWith(':main')
        && messages.length === 0
        && !sessionLastActivity[currentSessionKey]
        && !sessionLabels[currentSessionKey];
      set((s) => ({
        currentSessionKey: key,
        currentAgentId: getAgentIdFromSessionKey(key),
        messages: [],
        streamingText: '',
        streamingMessage: null,
        streamingTools: [],
        activeRunId: null,
        error: null,
        pendingFinal: false,
        lastUserMessageAt: null,
        pendingToolImages: [],
        ...(leavingEmpty ? {
          sessions: s.sessions.filter((s) => s.key !== currentSessionKey),
          sessionLabels: Object.fromEntries(
            Object.entries(s.sessionLabels).filter(([k]) => k !== currentSessionKey),
          ),
          sessionLastActivity: Object.fromEntries(
            Object.entries(s.sessionLastActivity).filter(([k]) => k !== currentSessionKey),
          ),
        } : {}),
      }));
      get().loadHistory();
    },

    // ── Delete session ──
    //
    // NOTE: The OpenClaw Gateway does NOT expose a sessions.delete (or equivalent)
    // RPC — confirmed by inspecting client.ts, protocol.ts and the full codebase.
    // Deletion is therefore a local-only UI operation: the session is removed from
    // the sidebar list and its labels/activity maps are cleared.  The underlying
    // JSONL history file on disk is intentionally left intact, consistent with the
    // newSession() design that avoids sessions.reset to preserve history.

    deleteSession: async (key: string) => {
      // Soft-delete the session's JSONL transcript on disk.
      // The main process renames <suffix>.jsonl → <suffix>.deleted.jsonl so that
      // sessions.list skips it automatically.
      try {
        const result = await invokeIpc('session:delete', key) as {
          success: boolean;
          error?: string;
        };
        if (!result.success) {
          console.warn(`[deleteSession] IPC reported failure for ${key}:`, result.error);
        }
      } catch (err) {
        console.warn(`[deleteSession] IPC call failed for ${key}:`, err);
      }

      const { currentSessionKey, sessions } = get();
      const remaining = sessions.filter((s) => s.key !== key);

      if (currentSessionKey === key) {
        // Switched away from deleted session — pick the first remaining or create new
        const next = remaining[0];
        set((s) => ({
          sessions: remaining,
          sessionLabels: Object.fromEntries(Object.entries(s.sessionLabels).filter(([k]) => k !== key)),
          sessionLastActivity: Object.fromEntries(Object.entries(s.sessionLastActivity).filter(([k]) => k !== key)),
          messages: [],
          streamingText: '',
          streamingMessage: null,
          streamingTools: [],
          activeRunId: null,
          error: null,
          pendingFinal: false,
          lastUserMessageAt: null,
          pendingToolImages: [],
          currentSessionKey: next?.key ?? DEFAULT_SESSION_KEY,
          currentAgentId: getAgentIdFromSessionKey(next?.key ?? DEFAULT_SESSION_KEY),
        }));
        if (next) {
          get().loadHistory();
        }
      } else {
        set((s) => ({
          sessions: remaining,
          sessionLabels: Object.fromEntries(Object.entries(s.sessionLabels).filter(([k]) => k !== key)),
          sessionLastActivity: Object.fromEntries(Object.entries(s.sessionLastActivity).filter(([k]) => k !== key)),
        }));
      }
    },

    // ── New session ──

    newSession: () => {
      // Generate a new unique session key and switch to it.
      // NOTE: We intentionally do NOT call sessions.reset on the old session.
      // sessions.reset archives (renames) the session JSONL file, making old
      // conversation history inaccessible when the user switches back to it.
      const { currentSessionKey, messages, sessionLastActivity, sessionLabels } = get();
      // Only treat sessions with no history records and no activity timestamp as empty
      const leavingEmpty = !currentSessionKey.endsWith(':main')
        && messages.length === 0
        && !sessionLastActivity[currentSessionKey]
        && !sessionLabels[currentSessionKey];
      const prefix = getCanonicalPrefixFromSessions(get().sessions) ?? DEFAULT_CANONICAL_PREFIX;
      const newKey = `${prefix}:session-${Date.now()}`;
      const newSessionEntry: ChatSession = { key: newKey, displayName: newKey };
      set((s) => ({
        currentSessionKey: newKey,
        currentAgentId: getAgentIdFromSessionKey(newKey),
        sessions: [
          ...(leavingEmpty ? s.sessions.filter((sess) => sess.key !== currentSessionKey) : s.sessions),
          newSessionEntry,
        ],
        sessionLabels: leavingEmpty
          ? Object.fromEntries(Object.entries(s.sessionLabels).filter(([k]) => k !== currentSessionKey))
          : s.sessionLabels,
        sessionLastActivity: leavingEmpty
          ? Object.fromEntries(Object.entries(s.sessionLastActivity).filter(([k]) => k !== currentSessionKey))
          : s.sessionLastActivity,
        messages: [],
        streamingText: '',
        streamingMessage: null,
        streamingTools: [],
        activeRunId: null,
        error: null,
        pendingFinal: false,
        lastUserMessageAt: null,
        pendingToolImages: [],
      }));
    },

    // ── Cleanup empty session on navigate away ──

    cleanupEmptySession: () => {
      const { currentSessionKey, messages, sessionLastActivity, sessionLabels } = get();
      // Only remove non-main sessions that were never used (no messages sent).
      // This mirrors the "leavingEmpty" logic in switchSession so that creating
      // a new session and immediately navigating away doesn't leave a ghost entry
      // in the sidebar.
      // Also check sessionLastActivity and sessionLabels comprehensively to prevent
      // falsely treating sessions with history as empty due to switchSession clearing messages early.
      const isEmptyNonMain = !currentSessionKey.endsWith(':main')
        && messages.length === 0
        && !sessionLastActivity[currentSessionKey]
        && !sessionLabels[currentSessionKey];
      if (!isEmptyNonMain) return;
      set((s) => ({
        sessions: s.sessions.filter((sess) => sess.key !== currentSessionKey),
        sessionLabels: Object.fromEntries(
          Object.entries(s.sessionLabels).filter(([k]) => k !== currentSessionKey),
        ),
        sessionLastActivity: Object.fromEntries(
          Object.entries(s.sessionLastActivity).filter(([k]) => k !== currentSessionKey),
        ),
      }));
    },

    // ── Load chat history ──

  };
}
