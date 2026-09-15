import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Attempts } from '@/lib/services';
import { useQuery } from '@/hooks/useApi';
import { LoadingState, ErrorState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { formatDuration } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { AttemptQuestion } from '@/types';

export function QuizTakingPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, refetch } = useQuery(() => Attempts.get(attemptId!), [attemptId]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [seconds, setSeconds] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');
  const startedRef = useRef(Date.now());
  const dirtyRef = useRef<Set<string>>(new Set());
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;

  // hydrate from server
  useEffect(() => {
    if (!data) return;
    if (data.attempt.status === 'completed') {
      navigate(`/member/results/${data.attempt.id}`, { replace: true });
      return;
    }
    const initial: Record<string, string> = {};
    data.questions.forEach((q) => {
      if (q.yourAnswer) initial[q.id] = q.yourAnswer;
    });
    setAnswers(initial);
    setSeconds(data.secondsRemaining);
  }, [data, navigate]);

  const questions = data?.questions ?? [];
  const q: AttemptQuestion | undefined = questions[current];

  const flushSave = useCallback(async () => {
    if (!attemptId || dirtyRef.current.size === 0 || submittedRef.current) return;
    const ids = [...dirtyRef.current];
    dirtyRef.current.clear();
    const payload = ids.map((qid) => ({ questionId: qid, answerText: answersRef.current[qid] ?? '' }));
    try {
      await Attempts.saveAnswers(attemptId, payload);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      ids.forEach((id) => dirtyRef.current.add(id)); // retry later
      if (err instanceof ApiError && err.status === 400) {
        doNavigateToResult();
      }
    }
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doNavigateToResult = useCallback(() => {
    submittedRef.current = true;
    navigate(`/member/results/${attemptId}`, { replace: true });
  }, [attemptId, navigate]);

  const submit = useCallback(async () => {
    if (submittingRef.current || submittedRef.current || !attemptId) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await flushSave(); // persist any pending answers first
      submittedRef.current = true; // now stop autosave / countdown
      const timeSpent = Math.round((Date.now() - startedRef.current) / 1000);
      const res = await Attempts.submit(attemptId, timeSpent);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      navigate(`/member/results/${res.attempt.id}`, { replace: true });
    } catch (err) {
      submittedRef.current = false;
      submittingRef.current = false;
      setSubmitting(false);
      toast.error(err instanceof ApiError ? err.message : 'Submission failed — try again');
    }
  }, [attemptId, flushSave, navigate, toast]);

  // countdown
  useEffect(() => {
    if (!data || data.attempt.status !== 'in_progress') return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [data, submit]);

  // periodic autosave + resync on unmount
  useEffect(() => {
    const id = setInterval(flushSave, 8000);
    return () => {
      clearInterval(id);
      flushSave();
    };
  }, [flushSave]);

  const setAnswer = (qid: string, value: string) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    dirtyRef.current.add(qid);
    setSavedAt('');
  };

  const answeredCount = useMemo(
    () => questions.filter((qq) => (answers[qq.id] ?? '').trim() !== '').length,
    [questions, answers],
  );

  if (loading) return <LoadingState label="Loading your attempt…" className="min-h-screen" />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} className="min-h-screen" />;
  if (!q) return <ErrorState error={{ message: 'This attempt has no questions.' }} className="min-h-screen" />;

  const low = seconds < 300;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                {data.quiz.courseCode}
              </span>
              <h1 className="text-sm md:text-base font-bold text-slate-900 line-clamp-1">{data.quiz.title}</h1>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {savedAt ? `Saved ${savedAt}` : dirtyRef.current.size ? 'Saving…' : 'All changes saved'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm border ${
                low ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse' : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">timer</span>
              {formatDuration(seconds)}
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              Submit <span className="material-symbols-outlined text-sm">check</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 lg:px-8 py-6 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 lg:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800">
                  Question {current + 1} of {questions.length}
                </span>
                <span className="text-xs font-medium text-slate-500">{q.marks} marks</span>
                <span className="text-xs font-medium text-slate-400 capitalize">{q.type.replace('_', ' ')}</span>
              </div>
              <button
                onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  flags[q.id] ? 'bg-amber-50 text-amber-800 border-amber-300' : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-sm text-amber-500">
                  {flags[q.id] ? 'bookmark_added' : 'bookmark_border'}
                </span>
                {flags[q.id] ? 'Flagged' : 'Flag'}
              </button>
            </div>

            <h2 className="text-base lg:text-lg font-bold text-slate-900 leading-relaxed">{q.questionText}</h2>

            {q.type === 'short_answer' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Your answer</label>
                <textarea
                  rows={6}
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Type your response…"
                  className="w-full p-4 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm outline-none"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {q.options.map((opt, idx) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={idx}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3.5 ${
                        selected ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border ${
                          selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className={`text-sm font-medium ${selected ? 'text-blue-900 font-semibold' : 'text-slate-800'}`}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span> Previous
              </button>
              {current < questions.length - 1 ? (
                <button
                  onClick={() => {
                    flushSave();
                    setCurrent((c) => c + 1);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  Next <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              ) : (
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  Finish <span className="material-symbols-outlined text-sm">check_circle</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Navigator</h3>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>Answered</span>
                <span className="font-bold text-slate-900">
                  {answeredCount} / {questions.length}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((qq, idx) => {
                const isAns = (answers[qq.id] ?? '').trim() !== '';
                const isCur = idx === current;
                return (
                  <button
                    key={qq.id}
                    onClick={() => setCurrent(idx)}
                    className={`relative h-10 rounded-xl text-xs font-bold border flex items-center justify-center ${
                      isAns ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700 border-slate-200'
                    } ${isCur ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    {idx + 1}
                    {flags[qq.id] && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              Submit assessment <span className="material-symbols-outlined text-base">task_alt</span>
            </button>
          </div>
        </div>
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Submit your assessment?</h3>
              <p className="text-xs text-slate-500 mt-1">
                You answered <strong>{answeredCount} of {questions.length}</strong> questions.
                {questions.length - answeredCount > 0 && (
                  <span className="text-rose-600 font-semibold block mt-1">
                    {questions.length - answeredCount} unanswered question(s) will score 0.
                  </span>
                )}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-xs flex justify-between text-slate-600">
              <span>Time remaining</span>
              <span className="font-mono font-bold text-slate-900">{formatDuration(seconds)}</span>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Keep working
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                {submitting ? <Spinner /> : <span className="material-symbols-outlined text-sm">send</span>}
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
