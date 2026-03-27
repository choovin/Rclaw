import React from 'react';
import { useAuthStore } from '@/stores/auth';
import { LogOut, User } from 'lucide-react';

export const HeaderAuth: React.FC = () => {
  const { isLoggedIn, userInfo, openLoginModal, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      setMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <button
        onClick={openLoginModal}
        aria-label="登录"
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-lg">☁️</span>
        <span>未登录</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors"
      >
        {userInfo?.avatar ? (
          <img src={userInfo.avatar} className="w-6 h-6 rounded-full" />
        ) : (
          <User className="w-5 h-5" />
        )}
        <span>{userInfo?.username || userInfo?.nickname || '用户'}</span>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-lg shadow-lg py-1 z-50" role="menu">
            <div className="px-3 py-2 text-sm text-muted-foreground border-b">
              {userInfo?.mobile && <div>手机: {userInfo.mobile}</div>}
            </div>
            <button
              onClick={handleLogout}
              role="menuitem"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
};
