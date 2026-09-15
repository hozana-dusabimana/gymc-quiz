import { Link } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Analytics } from '@/lib/services';
import { PageHeader, StatCard, StatusPill } from '@/components/common';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { pct } from '@/lib/format';

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  short_answer: 'Short answer',
};

export function AnalyticsPage() {
  const { data, loading, error, refetch } = useQuery(() => Analytics.overview(), []);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const { quizzes, distribution: d, hardestQuestions } = data;
  const bands = [
    { label: '90–100% (A)', count: d.a, tone: 'bg-emerald-500' },
    { label: '75–89% (B)', count: d.b, tone: 'bg-blue-500' },
    { label: '60–74% (C)', count: d.c, tone: 'bg-amber-500' },
    { label: '< 60% (needs review)', count: d.d, tone: 'bg-rose-500' },
  ].map((b) => ({ ...b, percent: d.total ? Math.round((b.count / d.total) * 100) : 0 }));

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Analytics & grades"
        subtitle="Performance across all your assessments"
        actions={
          <Link
            to="/leader/analytics/report"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs shadow-xs flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">description</span>
            Printable report
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Assessments" value={quizzes.length} icon="assignment" tone="indigo" />
        <StatCard label="Total submissions" value={d.total} icon="how_to_reg" tone="blue" />
        <StatCard
          label="Overall average"
          value={d.averageScore != null ? `${d.averageScore}%` : '—'}
          icon="analytics"
          tone="emerald"
        />
        <StatCard label="Below cutoff" value={d.belowCutoff} icon="trending_down" tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">bar_chart</span>
            Score distribution — all assessments
          </h2>
          {d.total === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No graded submissions yet.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {bands.map((b) => (
                <div key={b.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{b.label}</span>
                    <span className="text-slate-500">
                      {b.count} {b.count === 1 ? 'result' : 'results'} ({b.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${b.tone} rounded-full`} style={{ width: `${b.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">psychology</span>
            <h3 className="font-bold text-sm text-indigo-200">Lowest-accuracy questions</h3>
          </div>
          {hardestQuestions.length === 0 ? (
            <p className="text-xs text-slate-300">Not enough data yet.</p>
          ) : (
            <div className="space-y-3 text-xs">
              {hardestQuestions.slice(0, 3).map((q) => (
                <div key={q.id} className="p-3 rounded-xl bg-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-indigo-200">{q.courseCode}</span>
                    <span
                      className={`font-bold ${
                        (q.accuracy ?? 0) < 50 ? 'text-rose-300' : 'text-amber-300'
                      }`}
                    >
                      {q.accuracy != null ? `${q.accuracy}%` : '—'} correct
                    </span>
                  </div>
                  <p className="text-slate-200 line-clamp-2">{q.questionText}</p>
                  <span className="text-[10px] text-slate-400">
                    {TYPE_LABEL[q.type]} • {q.answered} answered
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">quiz</span>
          Per-assessment
        </h2>
        {quizzes.length === 0 && (
          <EmptyState
            icon="assignment"
            title="No assessments yet"
            description="Create a quiz to start seeing analytics."
            action={
              <Link to="/leader/quizzes/new" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
                Create quiz
              </Link>
            }
          />
        )}
        {quizzes.map((quiz) => (
          <Link
            key={quiz.id}
            to={`/leader/quizzes/${quiz.id}/analytics`}
            className="block bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-400 transition-all"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                    {quiz.courseCode}
                  </span>
                  <StatusPill status={quiz.status} />
                </div>
                <h3 className="font-bold text-slate-900 line-clamp-1">{quiz.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{quiz.courseTitle}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-extrabold text-slate-900">{quiz.submissions}</div>
                <div className="text-[10px] text-slate-400">submissions</div>
                <div className="text-xs font-bold text-emerald-600 mt-1">{pct(quiz.averageScore)}</div>
              </div>
              <span className="material-symbols-outlined text-slate-300 shrink-0">chevron_right</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
