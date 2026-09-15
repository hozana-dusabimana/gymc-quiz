import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Attempts, Quizzes } from '@/lib/services';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { StatCard, StatusPill } from '@/components/common';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, pct } from '@/lib/format';

export function QuizAnalyticsPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const quiz = useQuery(() => Quizzes.get(quizId!), [quizId]);
  const attempts = useQuery(() => Attempts.forQuiz(quizId!), [quizId]);
  const [search, setSearch] = useState('');

  if (quiz.loading) return <LoadingState />;
  if (quiz.error || !quiz.data) return <ErrorState error={quiz.error} onRetry={quiz.refetch} />;

  const q = quiz.data.quiz;
  const rows = (attempts.data || []).filter(
    (a) =>
      (a.memberName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.memberNumber || '').toLowerCase().includes(search.toLowerCase()),
  );
  const completed = (attempts.data || []).filter((a) => a.status === 'completed');
  const scores = completed.map((a) => a.percentage ?? 0);
  const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null;
  const high = scores.length ? Math.max(...scores) : null;
  const low = scores.length ? Math.min(...scores) : null;
  const bands = [
    { label: '90–100% (A)', lo: 90, hi: 101, tone: 'bg-emerald-500' },
    { label: '75–89% (B)', lo: 75, hi: 90, tone: 'bg-blue-500' },
    { label: '60–74% (C)', lo: 60, hi: 75, tone: 'bg-amber-500' },
    { label: '< 60% (needs review)', lo: 0, hi: 60, tone: 'bg-rose-500' },
  ].map((b) => {
    const count = scores.filter((s) => s >= b.lo && s < b.hi).length;
    return { ...b, count, percent: scores.length ? Math.round((count / scores.length) * 100) : 0 };
  });

  const setStatus = async (action: 'publish' | 'close') => {
    try {
      if (action === 'publish') await Quizzes.publish(q.id);
      else await Quizzes.close(q.id);
      toast.success(action === 'publish' ? 'Quiz published' : 'Quiz closed');
      quiz.refetch();
    } catch {
      toast.error('Could not update the quiz');
    }
  };

  const statusActions = (
    <>
      <Link
        to={`/leader/quizzes/${q.id}/report`}
        className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-sm">description</span> Marks sheet
      </Link>
      <Link
        to={`/leader/quizzes/new?courseId=${q.courseId}`}
        className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
      >
        Duplicate setup
      </Link>
      {q.status === 'draft' && (
        <button onClick={() => setStatus('publish')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">
          Publish
        </button>
      )}
      {q.status === 'published' && (
        <button onClick={() => setStatus('close')} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold">
          Close quiz
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/leader/analytics" className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Analytics
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              {q.courseCode}
            </span>
            <StatusPill status={q.status} />
          </div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{q.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {q.totalMarks} marks • pass {q.passingScore}% • {q.durationMinutes} min
          </p>
        </div>
        <div className="flex items-center gap-2">{statusActions}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Submissions" value={completed.length} icon="how_to_reg" tone="indigo" />
        <StatCard label="Class average" value={avg != null ? `${avg}%` : '—'} icon="analytics" tone="blue" />
        <StatCard label="Highest" value={high != null ? `${high}%` : '—'} icon="trending_up" tone="emerald" />
        <StatCard label="Lowest" value={low != null ? `${low}%` : '—'} icon="trending_down" tone="amber" />
      </div>

      {scores.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">bar_chart</span>
            Score distribution breakdown
          </h2>
          <div className="space-y-3 pt-1">
            {bands.map((b) => (
              <div key={b.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{b.label}</span>
                  <span className="text-slate-500">
                    {b.count} {b.count === 1 ? 'member' : 'members'} ({b.percent}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${b.tone} rounded-full`} style={{ width: `${b.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">Member submissions ({rows.length})</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or ID…"
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
          />
        </div>

        {attempts.loading && <LoadingState className="py-8" />}
        {!attempts.loading && rows.length === 0 && (
          <EmptyState icon="how_to_reg" title="No submissions yet" className="border-0" />
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Member</th>
                  <th className="p-3">Submitted</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">%</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{a.memberName}</div>
                      <div className="text-[10px] text-slate-400">{a.memberNumber || a.memberEmail}</div>
                    </td>
                    <td className="p-3 text-slate-600">{formatDateTime(a.submittedAt)}</td>
                    <td className="p-3 font-bold text-slate-900">
                      {a.score ?? '—'} / {a.maxScore ?? q.totalMarks}
                    </td>
                    <td className="p-3">
                      <span className={`font-bold ${(a.percentage ?? 0) >= q.passingScore ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {pct(a.percentage)}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{a.timeSpentMinutes ?? '—'} min</td>
                    <td className="p-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="p-3 text-right">
                      {a.status === 'completed' && (
                        <button
                          onClick={() => navigate(`/leader/results/${a.id}`)}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* bottom action bar — same controls as the header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <Link to="/leader/analytics" className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back to analytics
        </Link>
        <div className="flex items-center gap-2">{statusActions}</div>
      </div>
    </div>
  );
}
