/**
 * Main Layout Component
 * TitleBar at top, then sidebar + content below.
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { LoginModal } from '@/components/common/LoginModal';
import { VersionDisplay } from './VersionDisplay';

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Title bar: drag region on macOS, icon + controls on Windows */}
      <TitleBar />

      {/* Below the title bar: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto" style={{ backgroundColor: 'hsl(var(--background))' }}>
          <div key={location.pathname} className="animate-fade-in min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Version display at bottom left */}
      <VersionDisplay />

      {/* Login modal overlay */}
      <LoginModal />
    </div>
  );
}
