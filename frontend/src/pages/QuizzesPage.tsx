import { Link } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Quizzes } from '@/lib/services';
import { PageHeader, StatusPill } from '@/components/common';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { deadlineLabel, pct } from '@/lib/format';

export function QuizzesPage() {
  const { data, loading, error, refetch } = useQuery(() => Quizzes.list(), []);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Quizzes" subtitle="Assessments from your enrolled courses" />

      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState icon="quiz" title="No quizzes available" description="Published assessments will appear here." />
      )}

      <div className="space-y-3">
        {(data || []).map((quiz) => {
          const avail = quiz.availability;
          const done = (avail?.completedCount ?? 0) > 0;
          return (
            <div key={quiz.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                      {quiz.courseCode}
                    </span>
                    <StatusPill status={quiz.status} />
                    {avail?.hasInProgress && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        In progress
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900">{quiz.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{quiz.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-500">
                    <span>{quiz.durationMinutes} min</span>
                    <span>{quiz.questionCount} questions</span>
                    <span>{quiz.totalMarks} marks</span>
                    <span className={deadlineLabel(quiz.deadline) === 'Closed' ? 'text-rose-600 font-semibold' : ''}>
                      {deadlineLabel(quiz.deadline)}
                    </span>
                    <span>
                      Attempts: {quiz.myAttempts ?? 0}/{quiz.attemptsAllowed}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {done && quiz.lastAttempt?.status === 'completed' && (
                    <Link
                      to={`/member/results/${quiz.lastAttempt.id}`}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      View result ({pct(quiz.lastAttempt.percentage)})
                    </Link>
                  )}
                  {avail?.open ? (
                    <Link
                      to={`/member/quizzes/${quiz.id}`}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      {avail.hasInProgress ? 'Resume' : 'Start'}
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  ) : (
                    <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500">
                      {avail?.reason || 'Unavailable'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
