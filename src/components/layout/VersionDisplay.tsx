import { useEffect, useState } from 'react';
import { useGatewayStore } from '@/stores/gateway';

export function VersionDisplay() {
  const [appVersion, setAppVersion] = useState('');
  const gatewayVersion = useGatewayStore((s) => s.status.version);

  useEffect(() => {
    // Get app version from preload exposed versions
    if (window.electron?.versions?.app) {
      setAppVersion(window.electron.versions.app);
    }
  }, []);

  if (!appVersion) return null;

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-50 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Rclaw v{appVersion}</span>
      {gatewayVersion && (
        <>
          <span className="text-border">|</span>
          <span>OpenClaw v{gatewayVersion}</span>
        </>
      )}
    </div>
  );
}