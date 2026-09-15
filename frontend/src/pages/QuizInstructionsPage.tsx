import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Quizzes, Attempts } from '@/lib/services';
import { LoadingState, ErrorState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { deadlineLabel } from '@/lib/format';

export function QuizInstructionsPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, refetch } = useQuery(() => Quizzes.get(quizId!), [quizId]);
  const start = useMutation(Attempts.start);

  if (loading) return <LoadingState label="Loading quiz…" />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const { quiz, availability } = data;

  const begin = async () => {
    try {
      const view = await start.mutate(quiz.id);
      navigate(`/member/attempt/${view.attempt.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the quiz');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <Link to="/member/quizzes" className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to quizzes
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-5">
        <div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
            {quiz.courseCode}
          </span>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 mt-2">{quiz.title}</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{quiz.description || 'No additional instructions.'}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            ['schedule', `${quiz.durationMinutes} min`, 'Time limit'],
            ['format_list_numbered', quiz.questionCount, 'Questions'],
            ['grade', quiz.totalMarks, 'Total marks'],
            ['target', `${quiz.passingScore}%`, 'Passing score'],
          ].map(([icon, val, label]) => (
            <div key={label as string} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="material-symbols-outlined text-blue-600 text-lg">{icon as string}</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">{val}</div>
              <div className="text-[10px] text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">info</span> Before you begin
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-800">
            <li>The timer runs on the server — closing the tab will not pause it.</li>
            <li>Your answers auto-save as you go. The quiz submits automatically when time runs out.</li>
            <li>Attempts allowed: {quiz.attemptsAllowed}. Deadline: {deadlineLabel(quiz.deadline)}.</li>
          </ul>
        </div>

        {availability && !availability.open ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {availability.reason || 'This quiz is not currently available.'}
          </div>
        ) : (
          <button
            onClick={begin}
            disabled={start.loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {start.loading ? <Spinner /> : <span className="material-symbols-outlined text-base">play_arrow</span>}
            Start / resume assessment
          </button>
        )}
      </div>
    </div>
  );
}
