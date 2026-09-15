import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Courses, Questions, Quizzes } from '@/lib/services';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';

export function QuizCreatorPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const courses = useQuery(() => Courses.list(), []);

  const [step, setStep] = useState(1);
  const [courseId, setCourseId] = useState(params.get('courseId') || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passingScore, setPassingScore] = useState(50);
  const [deadline, setDeadline] = useState('');
  const [randomizeOrder, setRandomizeOrder] = useState(true);
  const [showInstantFeedback, setShowInstantFeedback] = useState(false);
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const effectiveCourse = courseId || courses.data?.[0]?.id || '';
  const questions = useQuery(
    () => (effectiveCourse ? Questions.list({ courseId: effectiveCourse }) : Promise.resolve([])),
    [effectiveCourse],
  );

  const chosen = (questions.data || []).filter((q) => selected.includes(q.id));
  const totalMarks = useMemo(() => chosen.reduce((s, q) => s + q.marks, 0), [chosen]);

  const publish = useMutation(async () => {
    const created = await Quizzes.create({
      courseId: effectiveCourse,
      title: title.trim(),
      description,
      durationMinutes,
      passingScore,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      randomizeOrder,
      showInstantFeedback,
      attemptsAllowed,
      questionIds: selected,
    });
    await Quizzes.publish(created.quiz.id);
    return created.quiz.id;
  });

  const saveDraft = useMutation(async () => {
    const created = await Quizzes.create({
      courseId: effectiveCourse,
      title: title.trim() || 'Untitled quiz',
      description,
      durationMinutes,
      passingScore,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      randomizeOrder,
      showInstantFeedback,
      attemptsAllowed,
      questionIds: selected,
    });
    return created.quiz.id;
  });

  const doPublish = async () => {
    try {
      await publish.mutate();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      toast.success('Quiz published — members have been notified');
      navigate('/leader');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not publish the quiz');
    }
  };

  if (courses.loading) return <LoadingState />;
  if (courses.error) return <ErrorState error={courses.error} onRetry={courses.refetch} />;
  if ((courses.data?.length ?? 0) === 0)
    return <EmptyState icon="school" title="Create a course first" description="You need a course before building a quiz." />;

  const canNext1 = title.trim().length >= 3 && effectiveCourse;
  const canPublish = chosen.length > 0 && canNext1;

  const doSaveDraft = async () => {
    try {
      await saveDraft.mutate();
      toast.success('Saved as draft');
      navigate('/leader');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save');
    }
  };

  const actionButtons = (
    <>
      <button
        onClick={doSaveDraft}
        disabled={saveDraft.loading || !canNext1}
        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
      >
        Save draft
      </button>
      {step < 3 ? (
        <button
          onClick={() => setStep((s) => s + 1)}
          disabled={step === 1 && !canNext1}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          Next <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      ) : (
        <button
          onClick={doPublish}
          disabled={!canPublish || publish.loading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          {publish.loading ? <Spinner /> : <span className="material-symbols-outlined text-base">rocket_launch</span>}
          Publish
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Back
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quiz creation studio</h1>
        </div>
        <div className="flex items-center gap-2">{actionButtons}</div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        {[
          [1, 'Details'],
          [2, `Questions (${chosen.length})`],
          [3, 'Settings & publish'],
        ].map(([n, label]) => (
          <button
            key={n as number}
            onClick={() => setStep(n as number)}
            className={`flex-1 flex items-center gap-3 p-2 rounded-xl text-left ${
              step === n ? 'bg-amber-50/70 border border-amber-200 text-amber-900' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                step === n ? 'bg-amber-600 text-white' : step > (n as number) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100'
              }`}
            >
              {step > (n as number) ? '✓' : (n as number)}
            </span>
            <span className="text-xs font-bold hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-xs space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="font-semibold text-slate-700 block mb-1">Course</span>
              <select value={effectiveCourse} onChange={(e) => setCourseId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 bg-white">
                {(courses.data || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700 block mb-1">Duration (minutes)</span>
              <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-slate-300" />
            </label>
          </div>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm: B+ Trees & Storage" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Instructions / description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full p-3 rounded-xl border border-slate-300" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="font-semibold text-slate-700 block mb-1">Passing score (%)</span>
              <input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-slate-300" />
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700 block mb-1">Deadline (optional)</span>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
            </label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Select questions</h2>
            <p className="text-xs text-slate-500">
              {chosen.length} selected • {totalMarks} total marks
            </p>
          </div>
          {questions.loading && <LoadingState className="py-8" />}
          {!questions.loading && (questions.data?.length ?? 0) === 0 && (
            <EmptyState
              icon="help_outline"
              title="No questions for this course"
              description="Add questions in the Question Bank or generate them from a material."
            />
          )}
          <div className="space-y-3">
            {(questions.data || []).map((q) => {
              const on = selected.includes(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== q.id) : [...s, q.id]))}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${
                    on ? 'border-amber-600 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 border shrink-0 ${
                      on ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {on && <span className="material-symbols-outlined text-sm">check</span>}
                  </span>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">
                        {q.type.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{q.difficulty}</span>
                      {!q.correctAnswer && (
                        <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">AI-graded</span>
                      )}
                      <span className="ml-auto font-bold text-slate-900">{q.marks} marks</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 leading-snug">{q.questionText}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-xs space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900">Settings</h2>
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 cursor-pointer">
            <div>
              <span className="font-bold text-slate-900 block">Randomize question order</span>
              <span className="text-slate-500">Each member gets a distinct permutation.</span>
            </div>
            <input type="checkbox" checked={randomizeOrder} onChange={(e) => setRandomizeOrder(e.target.checked)} className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 cursor-pointer">
            <div>
              <span className="font-bold text-slate-900 block">Show instant feedback</span>
              <span className="text-slate-500">Reveal explanations after the quiz is graded.</span>
            </div>
            <input type="checkbox" checked={showInstantFeedback} onChange={(e) => setShowInstantFeedback(e.target.checked)} className="w-4 h-4" />
          </label>
          <label className="block p-3.5 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-900 block mb-1">Attempts allowed</span>
            <select value={attemptsAllowed} onChange={(e) => setAttemptsAllowed(Number(e.target.value))} className="p-2 rounded-xl border border-slate-300 bg-white">
              <option value={1}>1 attempt (standard exam)</option>
              <option value={2}>2 attempts (best score kept)</option>
              <option value={99}>Unlimited practice</option>
            </select>
          </label>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
            <div>Questions: <strong>{chosen.length}</strong></div>
            <div>Total marks: <strong>{totalMarks}</strong></div>
            <div>Duration: <strong>{durationMinutes}m</strong></div>
            <div>Pass: <strong>{passingScore}%</strong></div>
          </div>
          {chosen.length === 0 && (
            <p className="text-rose-600 font-semibold">Add at least one question before publishing.</p>
          )}
        </div>
      )}

      {/* bottom action bar — mirrors the header so you don't scroll back up */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back
            </button>
          )}
          <span className="text-[11px] text-slate-400 font-semibold">
            Step {step} of 3
            {step === 2 ? ` · ${chosen.length} question${chosen.length === 1 ? '' : 's'} · ${totalMarks} marks` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">{actionButtons}</div>
      </div>
    </div>
  );
}
