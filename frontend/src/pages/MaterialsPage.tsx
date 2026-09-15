import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Courses, Materials } from '@/lib/services';
import { PageHeader, StatusPill, Modal } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { CourseMaterial } from '@/types';

export function MaterialsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const courseId = params.get('courseId') || '';
  const courses = useQuery(() => Courses.list(), []);
  const activeCourse = courseId || courses.data?.[0]?.id || '';

  const materials = useQuery(
    () => (activeCourse ? Materials.list(activeCourse) : Promise.resolve([])),
    [activeCourse],
  );
  const [search, setSearch] = useState('');
  const [genFor, setGenFor] = useState<CourseMaterial | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation(Materials.upload);

  // poll while anything is processing
  const anyProcessing = (materials.data || []).some((m) => m.status === 'processing' || m.status === 'uploading');
  useEffect(() => {
    if (!anyProcessing) return;
    const id = setInterval(() => materials.refetch(), 3000);
    return () => clearInterval(id);
  }, [anyProcessing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (file: File) => {
    if (!activeCourse) return toast.error('Pick a course first');
    try {
      await upload.mutate(activeCourse, file);
      toast.success(`Uploading "${file.name}" — processing will start automatically`);
      materials.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    }
  };

  const filtered = (materials.data || []).filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Learning materials"
        subtitle="Upload lecture slides and notes — the AI indexes them for grounded questions and feedback"
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={activeCourse}
          onChange={(e) => setParams({ courseId: e.target.value })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
        >
          {(courses.data || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
        }}
        className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50/70 transition-all p-8 text-center"
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.txt,.md"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {upload.loading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Spinner className="w-6 h-6 text-amber-600" />
            <p className="text-xs font-semibold text-slate-700">Uploading…</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white text-amber-600 mx-auto flex items-center justify-center shadow-md shadow-amber-500/10 border border-amber-100">
              <span className="material-symbols-outlined text-3xl">cloud_upload</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Drag &amp; drop a document, or</h3>
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
            >
              <span className="material-symbols-outlined text-base">folder_open</span> Browse files
            </button>
            <p className="text-xs text-slate-500">PDF, DOCX, PPTX, TXT or MD — up to 50 MB</p>
          </div>
        )}
      </div>

      <div className="relative w-full sm:w-72">
        <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-sm">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
        />
      </div>

      {materials.loading && <LoadingState />}
      {materials.error && <ErrorState error={materials.error} onRetry={materials.refetch} />}
      {!materials.loading && filtered.length === 0 && (
        <EmptyState icon="folder_open" title="No materials yet" description="Upload your first document above." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((mat) => (
          <div key={mat.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold text-[11px] border border-slate-300/60">
                  {mat.fileType.toUpperCase()}
                </div>
                <StatusPill status={mat.status} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{mat.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{mat.filename}</p>
              </div>
              {mat.status === 'failed' ? (
                <p className="text-xs text-rose-600 line-clamp-2">{mat.errorMessage || 'Processing failed'}</p>
              ) : (
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {mat.summary || (mat.status === 'processing' ? 'Extracting text and building the index…' : '')}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {mat.pageCount} pages • {mat.size}
                </span>
                <span>{timeAgo(mat.uploadedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={mat.status !== 'ready'}
                  onClick={() => setGenFor(mat)}
                  className="flex-1 py-2 bg-slate-50 hover:bg-amber-50 disabled:opacity-40 text-amber-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  Generate questions
                </button>
                {mat.status === 'failed' && (
                  <button
                    onClick={() => Materials.reprocess(mat.id).then(() => materials.refetch())}
                    className="p-2 text-slate-500 hover:text-amber-600 border border-slate-200 rounded-xl"
                    title="Retry"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${mat.title}"?`))
                      Materials.remove(mat.id).then(() => {
                        toast.success('Material deleted');
                        materials.refetch();
                      });
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-xl"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {genFor && (
        <GenerateQuestionsModal
          material={genFor}
          onClose={() => setGenFor(null)}
          onDone={(n) => {
            setGenFor(null);
            toast.success(`${n} questions added to the question bank`);
            materials.refetch();
          }}
        />
      )}
    </div>
  );
}

function GenerateQuestionsModal({
  material,
  onClose,
  onDone,
}: {
  material: CourseMaterial;
  onClose: () => void;
  onDone: (n: number) => void;
}) {
  const toast = useToast();
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('mixed');
  const gen = useMutation(Materials.generateQuestions);

  const run = async () => {
    try {
      const qs = await gen.mutate(material.id, { count, difficulty });
      onDone(qs.length);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generation failed — try again');
    }
  };

  return (
    <Modal
      title="Generate questions with AI"
      icon="auto_awesome"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={run}
            disabled={gen.loading}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {gen.loading && <Spinner />}
            Generate
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-500 mb-4">
        Questions are grounded strictly in <strong>{material.title}</strong> and saved to the question bank as drafts you
        can edit.
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">How many</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
            className="w-full p-2.5 rounded-xl border border-slate-300"
          />
        </label>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
          >
            <option value="mixed">Mixed</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </label>
      </div>
      {gen.loading && (
        <p className="mt-4 text-xs text-slate-500 flex items-center gap-2">
          <Spinner /> The AI is reading the material and drafting questions — this can take 10–20 seconds.
        </p>
      )}
    </Modal>
  );
}
