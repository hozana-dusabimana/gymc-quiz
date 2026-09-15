import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: string;
  tone?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'gold';
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
    gold: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white',
  };
  return (
    <div className="p-4 lg:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs font-semibold">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </div>
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      {hint && <p className="text-[11px] text-slate-500 font-medium">{hint}</p>}
    </div>
  );
}

export function TrendChip({
  delta,
  unit = '',
  invert = false,
}: {
  delta: number | null | undefined;
  unit?: string;
  invert?: boolean;
}) {
  if (delta == null || Number(delta.toFixed(1)) === 0) return null;
  const good = invert ? delta < 0 : delta > 0;
  const abs = Math.abs(Number(delta.toFixed(1)));
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold ${
        good ? 'text-emerald-600' : 'text-rose-500'
      }`}
    >
      <span className="material-symbols-outlined text-[13px] leading-none">
        {delta > 0 ? 'arrow_upward' : 'arrow_downward'}
      </span>
      {abs}
      {unit}
    </span>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'gold';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border border-rose-200',
    gold: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    closed: 'bg-rose-50 text-rose-700 border-rose-200',
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    processing: 'bg-amber-50 text-amber-700 border-amber-200',
    uploading: 'bg-blue-50 text-blue-700 border-blue-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    evaluating: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </div>
            )}
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = 'Confirm',
  className = '',
  children,
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  // simple 2-click confirm handled by parent via window.confirm for now
  return (
    <button
      className={className}
      onClick={() => {
        if (window.confirm(label || `${confirmLabel}?`)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}
