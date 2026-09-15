import { useNavigate } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Notifications } from '@/lib/services';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { timeAgo } from '@/lib/format';

const ICON: Record<string, string> = {
  quiz: 'quiz',
  grade: 'verified',
  material: 'menu_book',
  system: 'info',
};
const TONE: Record<string, string> = {
  quiz: 'bg-blue-100 text-blue-700',
  grade: 'bg-emerald-100 text-emerald-700',
  material: 'bg-purple-100 text-purple-700',
  system: 'bg-slate-100 text-slate-600',
};

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data, loading, refetch } = useQuery(() => Notifications.list(), []);

  const markAll = async () => {
    await Notifications.readAll();
    refetch();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-end p-4 pt-16" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">notifications</span>
            <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={markAll} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
              Mark all read
            </button>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {loading && <LoadingState label="Loading notifications…" className="py-10" />}
          {!loading && (data?.notifications.length ?? 0) === 0 && (
            <EmptyState icon="notifications_off" title="You're all caught up" className="m-4 border-0 bg-transparent" />
          )}
          {data?.notifications.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                await Notifications.read(n.id).catch(() => {});
                if (n.linkTarget) navigate(n.linkTarget);
                onClose();
              }}
              className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-3 ${
                !n.read ? 'bg-blue-50/40' : 'bg-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${TONE[n.type]}`}>
                <span className="material-symbols-outlined text-base">{ICON[n.type]}</span>
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-bold text-xs text-slate-900 leading-tight">{n.title}</div>
                <p className="text-[11px] text-slate-500 leading-snug">{n.message}</p>
                <span className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
