/**
 * Main Layout Component
 * Left: sidebar (full window height). Right: TitleBar + scrollable content.
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { LoginModal } from '@/components/common/LoginModal';
import { UpdateAvailableToast } from './UpdateAvailableToast';
import { AppMenu } from './AppMenu';

export function MainLayout() {
  const location = useLocation();
  const platform = window.electron?.platform;
  const showFloatingAppMenu = platform === 'linux';

  return (
    <div data-testid="main-layout" className="flex h-screen flex-row overflow-hidden bg-background">
      <Sidebar />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Title bar: drag region on macOS, icon + controls on Windows */}
        <TitleBar />
        {showFloatingAppMenu ? (
          <div className="pointer-events-none absolute right-2 top-2 z-[100]">
            <div className="pointer-events-auto">
              <AppMenu />
            </div>
          </div>
        ) : null}
        <main className="min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))' }}>
          <div key={location.pathname} className="animate-fade-in min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Login modal overlay */}
      <LoginModal />
      <UpdateAvailableToast />
    </div>
  );
}
