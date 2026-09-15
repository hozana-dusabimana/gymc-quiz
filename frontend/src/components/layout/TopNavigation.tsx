import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { Notifications } from '@/lib/services';
import { useWelcomeGuide } from '../WelcomeGuide';
import { JumpToScreen } from './JumpToScreen';

export function TopNavigation({
  onOpenNotifications,
  onToggleMobileNav,
}: {
  onOpenNotifications: () => void;
  onToggleMobileNav: () => void;
}) {
  const { user, logout } = useAuth();
  const { openGuide } = useWelcomeGuide();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const home = user?.role === 'member' ? '/member' : '/leader';

  const { data: notif } = useQuery(() => Notifications.list(), []);
  const unread = notif?.unreadCount ?? 0;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (user?.name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <Link to={home} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">school</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  GYMC <span className="text-blue-600">Quiz</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Gisozi Youth Mass Choir Quiz
              </p>
            </div>
          </Link>
          <div className="hidden md:block md:pl-2 md:ml-1 md:border-l md:border-slate-200">
            <JumpToScreen />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openGuide}
            data-tour="guide-button"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open the getting started guide"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            Guide
          </button>
          <button
            onClick={openGuide}
            className="sm:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open the getting started guide"
          >
            <span className="material-symbols-outlined text-[22px]">help</span>
          </button>

          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-rose-500 text-white border-2 border-white rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 pl-2 border-l border-slate-200"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-xs"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                  {initials}
                </span>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight capitalize">
                  {user?.prefix ? `${user.prefix} ` : ''}
                  {user?.role}
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-lg hidden lg:block">
                expand_more
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{user?.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                </div>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base text-slate-500">person</span>
                  Manage profile
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                    navigate('/login');
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
