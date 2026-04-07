import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGatewayStore } from '@/stores/gateway';
import { useSkillsStore } from '@/stores/skills';

const DEBOUNCE_MS = 300;
const MIN_INTERVAL_MS = 30_000;

/**
 * 进入聊天后自动拉取技能；Gateway 就绪时刷新；回到 `/`、窗口聚焦或页面可见时防抖刷新（带最短间隔）。
 */
export function useChatSkillsRefresh() {
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const gatewayState = useGatewayStore((s) => s.status.state);
  const location = useLocation();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoftFetchAtRef = useRef<number | null>(null);

  const scheduleSoftRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const now = Date.now();
      if (
        lastSoftFetchAtRef.current !== null &&
        now - lastSoftFetchAtRef.current < MIN_INTERVAL_MS
      ) {
        return;
      }
      lastSoftFetchAtRef.current = now;
      void fetchSkills();
    }, DEBOUNCE_MS);
  }, [fetchSkills]);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    if (gatewayState === 'running') {
      void fetchSkills();
    }
  }, [gatewayState, fetchSkills]);

  useEffect(() => {
    if (location.pathname === '/') {
      scheduleSoftRefresh();
    }
  }, [location.pathname, scheduleSoftRefresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        scheduleSoftRefresh();
      }
    };
    window.addEventListener('focus', scheduleSoftRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', scheduleSoftRefresh);
      document.removeEventListener('visibilitychange', onVisible);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [scheduleSoftRefresh]);
}
