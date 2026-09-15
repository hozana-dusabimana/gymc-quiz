import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Courses, Materials, Questions } from '@/lib/services';
import { PageHeader, Modal, Badge } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { DifficultyLevel, Question, QuestionType } from '@/types';

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  short_answer: 'Short answer',
};

export function QuestionBankPage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const courses = useQuery(() => Courses.list(), []);
  const [courseId, setCourseId] = useState(params.get('courseId') || 'all');
  const [type, setType] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Question | 'new' | null>(null);

  const questions = useQuery(
    () => Questions.list({ courseId: courseId === 'all' ? undefined : courseId, type, difficulty, search }),
    [courseId, type, difficulty, search],
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Question bank"
        subtitle="Curate and tag questions with cited course-material sources"
        actions={
          <>
            <Link
              to="/leader/questions/import"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs shadow-xs flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              Import questions
            </Link>
            <button
              onClick={() => setEditing('new')}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New question
            </button>
          </>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center gap-2.5">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50">
          <option value="all">All courses</option>
          {(courses.data || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50">
          <option value="all">All difficulties</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50">
          <option value="all">All types</option>
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short answer</option>
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-sm">search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs" />
        </div>
      </div>

      {questions.loading && <LoadingState />}
      {questions.error && <ErrorState error={questions.error} onRetry={questions.refetch} />}
      {!questions.loading && (questions.data?.length ?? 0) === 0 && (
        <EmptyState
          icon="help_outline"
          title="No questions match"
          description="Create one manually, or generate from a material in the Material Library."
        />
      )}

      <div className="space-y-4">
        {(questions.data || []).map((q) => (
          <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono">
                  {q.courseCode}
                </span>
                <Badge tone={q.difficulty === 'Hard' ? 'rose' : q.difficulty === 'Medium' ? 'amber' : 'emerald'}>
                  {q.difficulty}
                </Badge>
                <span className="text-xs text-slate-400 font-medium">
                  {TYPE_LABEL[q.type]} • {q.marks} marks
                </span>
                {q.aiGenerated && <Badge tone="indigo">AI</Badge>}
                {!q.correctAnswer && <Badge tone="amber">AI-graded · no key</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  used in {q.quizzesUsedCount}
                </span>
                <button onClick={() => setEditing(q)} className="p-1 text-slate-400 hover:text-amber-600 rounded-lg" title="Edit">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this question?'))
                      Questions.remove(q.id)
                        .then(() => {
                          toast.success('Question deleted');
                          questions.refetch();
                        })
                        .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Delete failed'));
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>

            <h3 className="font-bold text-slate-900 text-sm md:text-base leading-relaxed">{q.questionText}</h3>

            {q.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.options.map((opt, i) => {
                  const correct = opt === q.correctAnswer;
                  return (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        correct
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          correct ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="truncate">{opt}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {q.type === 'short_answer' && q.correctAnswer && (
              <div className="text-xs p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-950">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block mb-1">
                  Model answer
                </span>
                {q.correctAnswer}
              </div>
            )}
            {q.type === 'short_answer' && !q.correctAnswer && (
              <div className="text-xs p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-600">auto_awesome</span>
                No model answer — the AI grades this against the course material.
              </div>
            )}

            {q.materialRef && (
              <div className="pt-2 flex items-center gap-1.5 text-xs text-amber-700 font-medium border-t border-slate-100">
                <span className="material-symbols-outlined text-base">auto_stories</span>
                Source: {q.materialRef.name}
                {q.materialRef.page ? ` (p.${q.materialRef.page})` : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <QuestionModal
          question={editing === 'new' ? null : editing}
          courses={courses.data || []}
          defaultCourseId={courseId !== 'all' ? courseId : courses.data?.[0]?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            questions.refetch();
            toast.success('Question saved');
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({
  question,
  courses,
  defaultCourseId,
  onClose,
  onSaved,
}: {
  question: Question | null;
  courses: { id: string; code: string; title: string }[];
  defaultCourseId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!question;
  const [courseId, setCourseId] = useState(question?.courseId || defaultCourseId || courses[0]?.id || '');
  const [type, setType] = useState<QuestionType>(question?.type || 'multiple_choice');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(question?.difficulty || 'Medium');
  const [questionText, setQuestionText] = useState(question?.questionText || '');
  const [options, setOptions] = useState<string[]>(
    question?.options?.length ? [...question.options, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
  );
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || '');
  const [markingGuidance, setMarkingGuidance] = useState(question?.markingGuidance || '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [marks, setMarks] = useState(question?.marks || 2);
  const [materialId, setMaterialId] = useState(question?.materialId || '');

  // Courses may still be loading when the modal mounts — adopt the first once available.
  useEffect(() => {
    if (!courseId && courses[0]?.id) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const materials = useQuery(
    () => (courseId ? Materials.list(courseId) : Promise.resolve([])),
    [courseId],
  );

  const save = useMutation(async () => {
    const body: any = { courseId, type, difficulty, questionText, explanation, marks: Number(marks), materialId: materialId || null };
    if (type === 'multiple_choice') {
      body.options = options.map((o) => o.trim()).filter(Boolean);
      body.correctAnswer = correctAnswer.trim(); // may be '' → AI grades against the material
    } else if (type === 'true_false') {
      body.correctAnswer = correctAnswer; // '' → AI grades
    } else {
      body.correctAnswer = correctAnswer.trim(); // '' → AI grades
      body.markingGuidance = markingGuidance;
    }
    return isEdit ? Questions.update(question!.id, body) : Questions.create(body);
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutate();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the question');
    }
  };

  const canSubmitMcq = useMemo(
    () =>
      type !== 'multiple_choice' ||
      correctAnswer.trim() === '' || // no key → AI grades it
      options.filter((o) => o.trim()).includes(correctAnswer.trim()),
    [type, options, correctAnswer],
  );
  const keyless =
    (type === 'multiple_choice' && correctAnswer.trim() === '') ||
    (type === 'true_false' && correctAnswer === '') ||
    (type === 'short_answer' && correctAnswer.trim() === '');

  return (
    <Modal
      title={isEdit ? 'Edit question' : 'Create question'}
      icon="edit_note"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            form="question-form"
            type="submit"
            disabled={save.loading || !canSubmitMcq || !courseId}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {save.loading && <Spinner />}
            {isEdit ? 'Save changes' : 'Add to bank'}
          </button>
        </>
      }
    >
      <form id="question-form" onSubmit={submit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Course</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={isEdit} className="w-full p-2 rounded-xl border border-slate-300 bg-white">
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} className="w-full p-2 rounded-xl border border-slate-300 bg-white">
              <option value="multiple_choice">Multiple choice</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short answer</option>
            </select>
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)} className="w-full p-2 rounded-xl border border-slate-300 bg-white">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Question text</span>
          <textarea required value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} className="w-full p-3 rounded-xl border border-slate-300" />
        </label>

        {type === 'multiple_choice' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 block">Options — select the correct one</span>
              {correctAnswer.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setCorrectAnswer('')}
                  className="text-[11px] font-semibold text-amber-600 hover:text-amber-700"
                >
                  Clear · let AI grade
                </button>
              )}
            </div>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctAnswer === opt && opt !== ''}
                  onChange={() => setCorrectAnswer(opt)}
                />
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                    if (correctAnswer === opt) setCorrectAnswer(e.target.value);
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className="flex-1 p-2 rounded-xl border border-slate-300"
                />
              </div>
            ))}
          </div>
        )}

        {type === 'true_false' && (
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Correct answer</span>
            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full p-2 rounded-xl border border-slate-300 bg-white">
              <option value="">Let AI decide (no key)</option>
              <option value="True">True</option>
              <option value="False">False</option>
            </select>
          </label>
        )}

        {type === 'short_answer' && (
          <>
            <label className="block">
              <span className="font-semibold text-slate-700 block mb-1">
                Model / expected answer <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <textarea value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} rows={2} className="w-full p-3 rounded-xl border border-slate-300" placeholder="Leave blank to let the AI grade against your course material" />
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700 block mb-1">Marking guidance (rubric)</span>
              <textarea value={markingGuidance} onChange={(e) => setMarkingGuidance(e.target.value)} rows={2} className="w-full p-3 rounded-xl border border-slate-300" placeholder="e.g. 1 mark per key point…" />
            </label>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Marks</span>
            <input type="number" min={1} max={20} value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-full p-2 rounded-xl border border-slate-300" />
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Link material (optional)</span>
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="w-full p-2 rounded-xl border border-slate-300 bg-white">
              <option value="">None</option>
              {(materials.data || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Explanation</span>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} className="w-full p-3 rounded-xl border border-slate-300" />
        </label>

        {keyless && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900">
            <span className="material-symbols-outlined text-sm text-amber-600">auto_awesome</span>
            <span>
              No answer key set. At correction time the AI works out the correct answer from this
              question and your course material, grades each member against it, and shows them the
              worked answer. Add a key above if you'd rather grade it exactly.
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
}
