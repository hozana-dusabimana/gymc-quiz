import type { ReactNode } from 'react';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className || 'w-4 h-4'}`}
      aria-hidden
    />
  );
}

export function LoadingState({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-slate-500 ${className}`}>
      <Spinner className="w-6 h-6 text-blue-600" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className = '',
}: {
  error: { message?: string } | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <span className="material-symbols-outlined text-2xl">error</span>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">Something went wrong</p>
        <p className="text-xs text-slate-500 mt-0.5 max-w-md">{error?.message || 'Please try again.'}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-14 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5 max-w-md">{description}</p>}
      </div>
      {action}
    </div>
  );
}
