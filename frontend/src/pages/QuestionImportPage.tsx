import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Courses, Questions } from '@/lib/services';
import type { QuestionDraft, QuestionImportResult } from '@/lib/services';
import { PageHeader } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { QuestionType } from '@/types';

const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.csv,.tsv,.json,.html,.htm,.rtf';
const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  short_answer: 'Short answer',
};

export function QuestionImportPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const courses = useQuery(() => Courses.list(), []);
  const [courseId, setCourseId] = useState(params.get('courseId') || '');
  const effectiveCourse = courseId || courses.data?.[0]?.id || '';

  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [result, setResult] = useState<QuestionImportResult | null>(null);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const parse = useMutation(Questions.importParse);
  const commit = useMutation(Questions.importCommit);

  const runParse = async () => {
    if (mode === 'file' && !file) return toast.error('Choose a file first');
    if (mode === 'text' && text.trim().length < 20) return toast.error('Paste at least a few questions first');
    try {
      const res = await parse.mutate(
        mode === 'file' ? { file: file!, hint } : { text, hint },
      );
      setResult(res);
      setDrafts(res.drafts);
      if (res.drafts.length === 0) toast.error('No questions were found in that source');
      else toast.success(`Found ${res.drafts.length} question${res.drafts.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not read that source');
    }
  };

  const patch = (tempId: string, next: Partial<QuestionDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.tempId === tempId ? { ...d, ...next } : d)));

  const included = drafts.filter((d) => d.include && d.questionText.trim().length >= 5);

  const runCommit = async () => {
    if (included.length === 0) return toast.error('Select at least one question to import');
    try {
      const res = await commit.mutate({
        courseId: effectiveCourse,
        drafts: included.map((d) => ({
          type: d.type,
          difficulty: d.difficulty,
          questionText: d.questionText.trim(),
          options: d.type === 'multiple_choice' ? d.options.map((o) => o.trim()).filter(Boolean) : undefined,
          correctAnswer: d.correctAnswer.trim(),
          markingGuidance: d.markingGuidance,
          explanation: d.explanation,
          marks: d.marks,
        })) as any,
      });
      const skipped = res.skipped.length;
      if (res.importedCount === 0) {
        toast.error(`Nothing imported — all ${skipped} question${skipped === 1 ? '' : 's'} were rejected. Check the flagged ones.`);
        return;
      }
      toast.success(
        `Imported ${res.importedCount} question${res.importedCount === 1 ? '' : 's'}` +
          (skipped ? ` — ${skipped} skipped` : ''),
      );
      navigate(`/leader/questions?courseId=${effectiveCourse}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Import failed');
    }
  };

  if (courses.loading) return <LoadingState />;
  if (courses.error) return <ErrorState error={courses.error} onRetry={courses.refetch} />;
  if ((courses.data?.length ?? 0) === 0)
    return <EmptyState icon="school" title="Create a course first" description="Questions are imported into a course." />;

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      <PageHeader
        title="Import questions"
        subtitle="Upload a question paper, past exam, spreadsheet or notes in any format — the AI extracts the questions, you review, then import."
        actions={
          <button
            onClick={() => navigate('/leader/questions')}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
          >
            Back to bank
          </button>
        }
      />

      {!result ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-xs space-y-5 text-xs">
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Target course</span>
            <select
              value={effectiveCourse}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full sm:w-80 p-2.5 rounded-xl border border-slate-300 bg-white"
            >
              {(courses.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 border-b border-slate-200">
            {(['file', 'text'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px ${
                  mode === m ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400'
                }`}
              >
                {m === 'file' ? 'Upload a file' : 'Paste text'}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
              }}
              className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-8 text-center"
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={ACCEPT}
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
              />
              <span className="material-symbols-outlined text-3xl text-indigo-600">upload_file</span>
              {file ? (
                <p className="mt-2 font-bold text-slate-900">{file.name}</p>
              ) : (
                <h3 className="mt-2 text-sm font-bold text-slate-900">Drag &amp; drop, or</h3>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                <span className="material-symbols-outlined text-base">folder_open</span>
                {file ? 'Choose a different file' : 'Browse files'}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">PDF, Word, PowerPoint, CSV, TSV, JSON, HTML, RTF, TXT, Markdown</p>
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={
                'Paste questions in any layout, e.g.\n\n1. What is the time complexity of binary search?\n   a) O(n)  b) O(log n)  c) O(n log n)  d) O(1)\n   Answer: b\n\n2. TCP is a connectionless protocol. (True/False)\n'
              }
              className="w-full p-3 rounded-xl border border-slate-300 font-mono text-[11px]"
            />
          )}

          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">
              Context for the AI <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g. Only rows 2–40 are questions; column D holds the answer key"
              className="w-full p-2.5 rounded-xl border border-slate-300"
            />
          </label>

          <div className="flex justify-end">
            <button
              onClick={runParse}
              disabled={parse.loading || !effectiveCourse}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2"
            >
              {parse.loading && <Spinner />}
              {parse.loading ? 'Reading & extracting…' : 'Read & extract questions'}
            </button>
          </div>
          {parse.loading && (
            <p className="text-[11px] text-slate-500 flex items-center gap-2">
              <Spinner /> Large documents are read in sections so nothing is missed — this can take 20–40 seconds.
            </p>
          )}
        </div>
      ) : (
        <ReviewStage
          result={result}
          drafts={drafts}
          included={included}
          patch={patch}
          setDrafts={setDrafts}
          onBack={() => {
            setResult(null);
            setDrafts([]);
          }}
          onImport={runCommit}
          importing={commit.loading}
        />
      )}
    </div>
  );
}

function ReviewStage({
  result,
  drafts,
  included,
  patch,
  setDrafts,
  onBack,
  onImport,
  importing,
}: {
  result: QuestionImportResult;
  drafts: QuestionDraft[];
  included: QuestionDraft[];
  patch: (tempId: string, next: Partial<QuestionDraft>) => void;
  setDrafts: React.Dispatch<React.SetStateAction<QuestionDraft[]>>;
  onBack: () => void;
  onImport: () => void;
  importing: boolean;
}) {
  const needsReview = drafts.filter((d) => d.status === 'needs_review').length;

  const addBlank = () =>
    setDrafts((ds) => [
      ...ds,
      {
        tempId: `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'multiple_choice',
        difficulty: 'Medium',
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        markingGuidance: '',
        explanation: '',
        marks: 1,
        hasAnswerKey: false,
        include: true,
        issues: [],
        status: 'needs_review',
      },
    ]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          <span className="font-bold text-slate-900">
            {result.stats.found} found
          </span>
          <span className="text-slate-400"> · </span>
          <span className="text-emerald-700 font-semibold">{included.length} selected</span>
          {needsReview > 0 && (
            <>
              <span className="text-slate-400"> · </span>
              <span className="text-amber-700 font-semibold">{needsReview} need a look</span>
            </>
          )}
          {result.meta.filename && (
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              {result.meta.filename} · {result.meta.pageCount} pages · {result.meta.windows} section(s) read
            </div>
          )}
          {result.meta.truncated && (
            <div className="text-[10px] text-amber-700 mt-0.5">
              ⚠ The document was very long — only the first part was scanned. Split it and import the rest separately.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrafts((ds) => ds.map((d) => ({ ...d, include: d.questionText.trim().length >= 5 })))}
            className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
          >
            Select all
          </button>
          <button
            onClick={() => setDrafts((ds) => ds.map((d) => ({ ...d, include: false })))}
            className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
          >
            Clear
          </button>
          <button onClick={onBack} className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
            Start over
          </button>
          <button
            onClick={onImport}
            disabled={importing || included.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {importing && <Spinner />}
            Import {included.length} question{included.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      {drafts.map((d, i) => (
        <DraftCard key={d.tempId} d={d} index={i} patch={patch} onRemove={() => setDrafts((ds) => ds.filter((x) => x.tempId !== d.tempId))} />
      ))}

      <button
        onClick={addBlank}
        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-1.5"
      >
        <span className="material-symbols-outlined text-base">add</span> Add a question manually
      </button>

      {/* bottom action bar — mirrors the sticky bar at the top */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
        <span className="text-xs">
          <span className="text-emerald-700 font-semibold">{included.length} selected</span>
          {needsReview > 0 && (
            <>
              <span className="text-slate-400"> · </span>
              <span className="text-amber-700 font-semibold">{needsReview} need a look</span>
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">
            Start over
          </button>
          <button
            onClick={onImport}
            disabled={importing || included.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {importing && <Spinner />}
            Import {included.length} question{included.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftCard({
  d,
  index,
  patch,
  onRemove,
}: {
  d: QuestionDraft;
  index: number;
  patch: (tempId: string, next: Partial<QuestionDraft>) => void;
  onRemove: () => void;
}) {
  const setOption = (i: number, v: string) => {
    const next = [...d.options];
    const wasCorrect = d.correctAnswer && d.correctAnswer === next[i];
    next[i] = v;
    patch(d.tempId, { options: next, ...(wasCorrect ? { correctAnswer: v } : {}) });
  };

  return (
    <div
      className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3 ${
        d.include ? 'border-slate-200' : 'border-slate-200 opacity-55'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={d.include}
            onChange={(e) => patch(d.tempId, { include: e.target.checked })}
            className="w-4 h-4"
          />
          #{index + 1}
        </label>
        <select
          value={d.type}
          onChange={(e) => patch(d.tempId, { type: e.target.value as QuestionType })}
          className="text-[11px] p-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
        >
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={d.difficulty}
          onChange={(e) => patch(d.tempId, { difficulty: e.target.value as QuestionDraft['difficulty'] })}
          className="text-[11px] p-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
        >
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          marks
          <input
            type="number"
            min={1}
            max={20}
            value={d.marks}
            onChange={(e) => patch(d.tempId, { marks: Math.max(1, Math.min(20, Number(e.target.value))) })}
            className="w-14 p-1 rounded-lg border border-slate-300"
          />
        </label>
        {d.status === 'needs_review' ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Needs review
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Ready
          </span>
        )}
        {!d.correctAnswer && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            AI-graded · no key
          </span>
        )}
        <button onClick={onRemove} className="ml-auto p-1 text-slate-400 hover:text-rose-600" title="Discard">
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>

      {d.issues.length > 0 && (
        <ul className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200 rounded-lg p-2 list-disc list-inside space-y-0.5">
          {d.issues.map((iss, i) => (
            <li key={i}>{iss}</li>
          ))}
        </ul>
      )}

      <textarea
        value={d.questionText}
        onChange={(e) => patch(d.tempId, { questionText: e.target.value })}
        rows={2}
        placeholder="Question text"
        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
      />

      {d.type === 'multiple_choice' && (
        <div className="space-y-1.5">
          {d.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`c-${d.tempId}`}
                checked={!!opt && d.correctAnswer === opt}
                onChange={() => patch(d.tempId, { correctAnswer: opt })}
              />
              <input
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 p-2 rounded-lg border border-slate-300 text-xs"
              />
              {d.options.length > 2 && (
                <button
                  onClick={() => {
                    const next = d.options.filter((_, x) => x !== i);
                    patch(d.tempId, { options: next });
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            {d.options.length < 8 && (
              <button
                onClick={() => patch(d.tempId, { options: [...d.options, ''] })}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
              >
                + Add option
              </button>
            )}
            {d.correctAnswer && (
              <button
                onClick={() => patch(d.tempId, { correctAnswer: '' })}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              >
                Clear key · let AI grade
              </button>
            )}
          </div>
        </div>
      )}

      {d.type === 'true_false' && (
        <select
          value={d.correctAnswer}
          onChange={(e) => patch(d.tempId, { correctAnswer: e.target.value })}
          className="p-2 rounded-lg border border-slate-300 bg-white text-xs"
        >
          <option value="">Let AI decide (no key)</option>
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      )}

      {d.type === 'short_answer' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <textarea
            value={d.correctAnswer}
            onChange={(e) => patch(d.tempId, { correctAnswer: e.target.value })}
            rows={2}
            placeholder="Model answer (optional)"
            className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
          />
          <textarea
            value={d.markingGuidance}
            onChange={(e) => patch(d.tempId, { markingGuidance: e.target.value })}
            rows={2}
            placeholder="Marking guidance / rubric (optional)"
            className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
          />
        </div>
      )}

      <input
        value={d.explanation}
        onChange={(e) => patch(d.tempId, { explanation: e.target.value })}
        placeholder="Explanation (optional)"
        className="w-full p-2 rounded-xl border border-slate-300 text-xs"
      />
    </div>
  );
}
