import { Link } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Results } from '@/lib/services';
import { PageHeader } from '@/components/common';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { formatDateTime, pct } from '@/lib/format';

export function ResultsPage() {
  const { data, loading, error, refetch } = useQuery(() => Results.mine(), []);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Results & insights" subtitle="Every assessment you've completed, with AI feedback" />

      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState icon="grading" title="No results yet" description="Take a quiz to see your diagnostics here." />
      )}

      <div className="space-y-3">
        {(data || []).map((r) => {
          const passed = r.passed;
          return (
            <Link
              key={r.id}
              to={`/member/results/${r.id}`}
              className="block bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-amber-400 transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono">
                      {r.courseCode}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {passed ? 'Passed' : 'Needs review'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 mt-1 line-clamp-1">{r.quizTitle}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatDateTime(r.completedAt)} • {r.timeSpentMinutes} min
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-2xl font-extrabold ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {pct(r.percentage)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {r.score}/{r.maxScore} pts
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
