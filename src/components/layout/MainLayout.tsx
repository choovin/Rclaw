/**
 * Main Layout Component
 * Left: sidebar (full window height). Right: TitleBar + scrollable content.
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { LoginModal } from '@/components/common/LoginModal';
import { VersionDisplay } from './VersionDisplay';
import { UpdateAvailableToast } from './UpdateAvailableToast';

export function MainLayout() {
  const location = useLocation();

  return (
    <div data-testid="main-layout" className="flex h-screen flex-row overflow-hidden bg-background">
      <Sidebar />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Title bar: drag region on macOS, icon + controls on Windows */}
        <TitleBar />
        <main className="min-h-0 flex-1 overflow-auto" style={{ backgroundColor: 'hsl(var(--background))' }}>
          <div key={location.pathname} className="animate-fade-in min-h-full">
            <Outlet />
          </div>
        </main>
        {/* Bottom-left of content column only (not under sidebar) */}
        <VersionDisplay />
      </div>

      {/* Login modal overlay */}
      <LoginModal />
      <UpdateAvailableToast />
    </div>
  );
}
