import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { Results } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { MaterialReferenceModal } from '@/components/MaterialReferenceModal';
import { formatDateTime, pct } from '@/lib/format';
import type { AnswerReference, Evaluation } from '@/types';

export function ResultDetailPage() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(() => Results.get(attemptId!), [attemptId]);
  const [ref, setRef] = useState<AnswerReference | null>(null);

  if (loading) return <LoadingState label="Loading result…" />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const { attempt, quiz } = data;
  const evaluations: Evaluation[] = data.evaluations ?? [];
  const passed = (attempt.percentage ?? 0) >= (quiz.passingScore ?? 50);
  const backTo = user?.role === 'leader' ? `/leader/quizzes/${quiz.id}/analytics` : '/member/results';
  const correct = evaluations.filter((e) => e.isCorrect === true).length;

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to={backTo} className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Back
          </Link>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">
            {user?.role === 'leader' ? `${attempt.memberName} — ` : ''}Assessment review
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {quiz.courseCode} • {quiz.title} • {formatDateTime(attempt.completedAt)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-50 to-blue-50/30 rounded-2xl border border-slate-200/80 text-center">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={passed ? 'text-blue-600' : 'text-amber-500'}
                strokeDasharray={`${attempt.percentage ?? 0}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-slate-900">{pct(attempt.percentage)}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {passed ? 'Passed' : 'Needs review'}
              </span>
            </div>
          </div>
          <span className="mt-3 text-xs font-bold text-slate-900">
            {attempt.score} of {attempt.maxScore} points
          </span>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Correct" value={`${correct}/${evaluations.length}`} />
            <Stat label="Time spent" value={`${attempt.timeSpentMinutes ?? '—'} min`} sub={`limit ${quiz.durationMinutes}m`} />
            <Stat label="Pass mark" value={`${quiz.passingScore}%`} sub={passed ? 'cleared' : 'below cutoff'} />
          </div>
          {attempt.aiSummary && (
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <span className="material-symbols-outlined text-base text-blue-600">auto_awesome</span>
                GYMC Quiz diagnostic summary
              </div>
              <p className="text-blue-950/80 leading-relaxed mt-1">{attempt.aiSummary}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">playlist_add_check</span>
          Question breakdown
        </h2>

        {evaluations.map((e, idx) => {
          const ok = e.isCorrect === true;
          const partial = !ok && e.score > 0;
          return (
            <div
              key={e.questionId}
              className={`bg-white rounded-2xl border p-5 lg:p-6 space-y-4 shadow-xs ${
                ok ? 'border-slate-200' : partial ? 'border-amber-200' : 'border-rose-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800">
                    Question {idx + 1}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      ok
                        ? 'bg-emerald-100 text-emerald-800'
                        : partial
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {ok ? 'check' : partial ? 'star_half' : 'close'}
                    </span>
                    {ok ? 'Correct' : partial ? 'Partial' : 'Incorrect'}
                  </span>
                  {e.gradedBy === 'ai' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      AI graded
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Earned{' '}
                  <strong className={ok ? 'text-emerald-700' : partial ? 'text-amber-700' : 'text-rose-700'}>
                    {e.score}
                  </strong>{' '}
                  / {e.maxScore}
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-900 leading-relaxed">{e.questionText}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div
                  className={`p-3 rounded-xl border ${
                    ok ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Your answer
                  </span>
                  <span className="font-medium text-slate-800">{e.yourAnswer || 'Not answered'}</span>
                </div>
                {!ok && e.correctAnswer && (
                  <div className="p-3 rounded-xl border bg-emerald-50/50 border-emerald-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block mb-1">
                      {e.type === 'short_answer' ? 'Model answer' : 'Correct answer'}
                    </span>
                    <span className="font-medium text-emerald-950">{e.correctAnswer}</span>
                  </div>
                )}
              </div>

              {(e.aiEvaluation || e.explanation) && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-sm">menu_book</span>
                    {e.aiEvaluation ? 'AI evaluation' : 'Explanation'}
                  </div>
                  <p className="leading-relaxed text-slate-600">{e.aiEvaluation || e.explanation}</p>
                  {e.aiFeedback && <p className="leading-relaxed text-slate-600 italic">{e.aiFeedback}</p>}
                </div>
              )}

              {e.references.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                    Learn more
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.references.map((r, i) =>
                      r.kind === 'online' && r.url ? (
                        <a
                          key={i}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 flex items-center gap-1.5 max-w-full"
                        >
                          <span className="material-symbols-outlined text-sm">public</span>
                          <span className="truncate">{r.title || 'Online reference'}</span>
                          <span className="material-symbols-outlined text-xs opacity-60">open_in_new</span>
                        </a>
                      ) : (
                        <button
                          key={i}
                          onClick={() => setRef(r)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">auto_stories</span>
                          {`Course material${r.page ? ` · p.${r.page}` : ''}`}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ref && <MaterialReferenceModal reference={ref} onClose={() => setRef(null)} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="text-base font-bold text-slate-900 mt-0.5">{value}</div>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}
