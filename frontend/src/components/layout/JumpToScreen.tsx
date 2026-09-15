import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

interface Screen {
  to: string;
  label: string;
  icon: string;
  /** extra words to match against when searching */
  keywords?: string;
  /** exact-match only when deciding which row is "current" */
  end?: boolean;
}

const SCREENS: Record<UserRole, Screen[]> = {
  member: [
    { to: '/member', label: 'Dashboard', icon: 'dashboard', end: true, keywords: 'home overview' },
    { to: '/member/quizzes', label: 'Quizzes', icon: 'quiz', keywords: 'assessments tests exams' },
    { to: '/member/results', label: 'Results & Insights', icon: 'insights', keywords: 'grades scores feedback marks' },
    { to: '/member/courses', label: 'My Courses', icon: 'menu_book', keywords: 'modules materials notes' },
    { to: '/profile', label: 'Manage profile', icon: 'person', keywords: 'account settings name password' },
  ],
  leader: [
    { to: '/leader', label: 'Dashboard', icon: 'space_dashboard', end: true, keywords: 'home overview leader workspace' },
    { to: '/leader/courses', label: 'Courses', icon: 'school', keywords: 'modules enrolment' },
    { to: '/leader/materials', label: 'Material Library', icon: 'upload_file', keywords: 'pdf slides notes upload documents' },
    { to: '/leader/questions', label: 'Question Bank', icon: 'help_outline', keywords: 'mcq true false short answer generate ai' },
    { to: '/leader/quizzes/new', label: 'Quiz Studio', icon: 'edit_note', keywords: 'create build publish wizard' },
    { to: '/leader/analytics', label: 'Analytics & Grades', icon: 'query_stats', keywords: 'submissions marking review scores stats' },
    { to: '/members', label: 'Members', icon: 'groups', keywords: 'manage edit deactivate choir members' },
    { to: '/profile', label: 'Manage profile', icon: 'person', keywords: 'account settings name' },
  ],
  admin: [
    { to: '/admin', label: 'Leaders & Admins', icon: 'admin_panel_settings', end: true, keywords: 'create manage staff accounts' },
    { to: '/members', label: 'Members', icon: 'groups', keywords: 'manage edit deactivate choir members' },
    { to: '/profile', label: 'Manage profile', icon: 'person', keywords: 'account settings name' },
  ],
};

function isCurrent(pathname: string, s: Screen): boolean {
  return s.end ? pathname === s.to : pathname === s.to || pathname.startsWith(s.to + '/');
}

export function JumpToScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const screens = user ? SCREENS[user.role] : [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return screens;
    return screens.filter((s) =>
      `${s.label} ${s.keywords ?? ''} ${s.to}`.toLowerCase().includes(q),
    );
  }, [query, screens]);

  // Reset the highlighted row whenever the result set changes.
  useEffect(() => setActive(0), [query, open]);

  // Focus the search box when the menu opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!user) return null;

  const go = (to: string) => {
    setOpen(false);
    setQuery('');
    if (to !== pathname) navigate(to);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[active];
      if (pick) go(pick.to);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-tour="jump-to-screen"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        title="Jump to any screen"
      >
        <span className="material-symbols-outlined text-[18px] text-amber-600">grid_view</span>
        <span className="hidden sm:inline">Jump to Screen</span>
        <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
        >
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100">
              <span className="material-symbols-outlined text-[18px] text-slate-400">search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search screens…"
                className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                aria-label="Search screens"
              />
            </div>
          </div>

          <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">No screen matches “{query}”.</div>
            ) : (
              results.map((s, i) => {
                const current = isCurrent(pathname, s);
                return (
                  <button
                    key={s.to}
                    role="menuitem"
                    data-active={i === active}
                    onClick={() => go(s.to)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs transition-colors ${
                      i === active ? 'bg-slate-100' : ''
                    } ${current ? 'text-amber-700 font-bold' : 'text-slate-700 font-medium'}`}
                  >
                    <span
                      className={`material-symbols-outlined text-[19px] ${
                        current ? 'text-amber-600' : 'text-slate-400'
                      }`}
                    >
                      {s.icon}
                    </span>
                    <span className="flex-1">{s.label}</span>
                    {current && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Here</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
