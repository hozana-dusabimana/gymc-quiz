import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { Quizzes } from '@/lib/services';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  badge?: string;
  end?: boolean;
}

// One consistent gold identity across every role — only the icon/label differ.
const THEME: Record<UserRole, { badgeBg: string; activeBg: string; badgeChip: string; icon: string; label: string }> = {
  member: {
    badgeBg: 'bg-amber-50/70 border-amber-200/80 text-amber-900',
    activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-amber-500/25',
    badgeChip: 'bg-amber-100 text-amber-700',
    icon: 'school',
    label: 'Choir Member',
  },
  leader: {
    badgeBg: 'bg-amber-50/70 border-amber-200/80 text-amber-900',
    activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-amber-500/25',
    badgeChip: 'bg-amber-100 text-amber-700',
    icon: 'psychology',
    label: 'Choir Leader',
  },
  admin: {
    badgeBg: 'bg-amber-50/70 border-amber-200/80 text-amber-900',
    activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-amber-500/25',
    badgeChip: 'bg-amber-100 text-amber-700',
    icon: 'admin_panel_settings',
    label: 'Administrator',
  },
};

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const role: UserRole = user?.role ?? 'member';
  const theme = THEME[role];

  const { data: quizzes } = useQuery(
    () => (role === 'member' ? Quizzes.list() : Promise.resolve([])),
    [role],
  );
  const openCount = (quizzes || []).filter((q) => q.availability?.open).length;

  const memberNav: NavItem[] = [
    { to: '/member', label: 'Dashboard', icon: 'dashboard', end: true },
    {
      to: '/member/quizzes',
      label: 'Quizzes',
      icon: 'quiz',
      badge: openCount > 0 ? `${openCount} open` : undefined,
    },
    { to: '/member/results', label: 'Results & Insights', icon: 'insights' },
    { to: '/member/courses', label: 'My Courses', icon: 'menu_book' },
  ];

  const leaderNav: NavItem[] = [
    { to: '/leader', label: 'Dashboard', icon: 'space_dashboard', end: true },
    { to: '/leader/courses', label: 'Courses', icon: 'school' },
    { to: '/leader/materials', label: 'Material Library', icon: 'upload_file' },
    { to: '/leader/questions', label: 'Question Bank', icon: 'help_outline' },
    { to: '/leader/quizzes/new', label: 'Quiz Studio', icon: 'edit_note' },
    { to: '/leader/analytics', label: 'Analytics & Grades', icon: 'query_stats' },
    { to: '/members', label: 'Members', icon: 'groups' },
  ];

  const adminNav: NavItem[] = [
    { to: '/admin', label: 'Leaders & Admins', icon: 'admin_panel_settings', end: true },
    { to: '/members', label: 'Members', icon: 'groups' },
  ];

  const nav = role === 'member' ? memberNav : role === 'leader' ? leaderNav : adminNav;

  const inner = (
    <div className="space-y-6">
      <div className={`p-3 rounded-xl border text-xs ${theme.badgeBg}`}>
        <div className="flex items-center gap-2 font-bold mb-1">
          <span className="material-symbols-outlined text-base">{theme.icon}</span>
          <span>{theme.label}</span>
        </div>
        <p className="text-[11px] text-slate-600">{user?.name}</p>
      </div>

      <nav className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-2">
          Main Menu
        </div>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            data-tour={`nav-${item.to}`}
            className={({ isActive }) =>
              `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? `${theme.activeBg} text-white shadow-md font-semibold` : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : theme.badgeChip
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* desktop */}
      <aside className="w-64 bg-white border-r border-[#e2e8f0] shrink-0 hidden md:flex flex-col p-4 min-h-[calc(100vh-61px)]">
        {inner}
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 shadow-xl overflow-y-auto animate-in slide-in-from-left">
            <div className="flex justify-end mb-2">
              <button onClick={onClose} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {inner}
          </aside>
        </div>
      )}
    </>
  );
}
