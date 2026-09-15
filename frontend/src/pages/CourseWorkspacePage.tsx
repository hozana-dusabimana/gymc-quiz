import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { Courses, Materials, Questions, Quizzes } from '@/lib/services';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { StatCard, StatusPill, Badge, Modal } from '@/components/common';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useApi';
import { ApiError } from '@/lib/api';
import { deadlineLabel, pct, formatDate } from '@/lib/format';

type Tab = 'overview' | 'materials' | 'questions' | 'quizzes' | 'members';

export function CourseWorkspacePage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isLeader = user?.role === 'leader';
  const [tab, setTab] = useState<Tab>('overview');
  const [showEnroll, setShowEnroll] = useState(false);

  const course = useQuery(() => Courses.get(courseId!), [courseId]);
  const materials = useQuery(() => Materials.list(courseId!), [courseId]);
  const quizzes = useQuery(() => Quizzes.list(courseId!), [courseId]);
  const questions = useQuery(
    () => (isLeader ? Questions.list({ courseId }) : Promise.resolve([])),
    [courseId, isLeader],
  );
  const members = useQuery(
    () => (isLeader ? Courses.members(courseId!) : Promise.resolve([])),
    [courseId, isLeader],
  );

  if (course.loading) return <LoadingState />;
  if (course.error || !course.data) return <ErrorState error={course.error} onRetry={course.refetch} />;
  const c = course.data;

  const tabs: [Tab, string, string][] = [
    ['overview', 'Overview', 'dashboard'],
    ['materials', `Materials (${c.materialsCount})`, 'folder'],
    ...(isLeader ? ([['questions', `Questions (${c.questionsCount})`, 'help_outline']] as [Tab, string, string][]) : []),
    ['quizzes', `Quizzes (${c.activeQuizzesCount})`, 'assignment'],
    ...(isLeader ? ([['members', `Members (${c.memberCount})`, 'group']] as [Tab, string, string][]) : []),
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-blue-100 text-blue-800">{c.code}</span>
              {c.department && <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{c.department}</span>}
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{c.title}</h1>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {c.description || 'No description provided.'}
            </p>
          </div>
          {isLeader && (
            <div className="flex items-center gap-2.5 shrink-0">
              <Link to={`/leader/materials?courseId=${c.id}`} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">upload</span> Upload
              </Link>
              <Link to={`/leader/quizzes/new?courseId=${c.id}`} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">add</span> Create quiz
              </Link>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-slate-400">person</span>
            {c.instructorName}
          </span>
          {c.schedule && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
              {c.schedule}
            </span>
          )}
          {c.room && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
              {c.room}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-slate-400">groups</span>
            {c.memberCount} members
          </span>
        </div>

        <div className="flex items-center gap-1 border-t border-slate-100 pt-3 overflow-x-auto">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                tab === id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Materials" value={c.materialsCount} icon="folder" tone="blue" />
          <StatCard label="Questions" value={c.questionsCount} icon="help_outline" tone="purple" />
          <StatCard label="Active quizzes" value={c.activeQuizzesCount} icon="assignment" tone="indigo" />
          <StatCard label="Course average" value={c.averageScore != null ? pct(c.averageScore, 1) : '—'} icon="trending_up" tone="emerald" />
        </div>
      )}

      {tab === 'materials' && (
        <TabList
          loading={materials.loading}
          error={materials.error}
          retry={materials.refetch}
          empty="No materials uploaded"
          items={materials.data}
          render={(m) => (
            <div key={m.id} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-mono font-bold text-[10px]">
                  {m.fileType.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-xs line-clamp-1">{m.title}</div>
                  <div className="text-[11px] text-slate-400">{m.pageCount} pages • {m.size}</div>
                </div>
              </div>
              <StatusPill status={m.status} />
            </div>
          )}
        />
      )}

      {tab === 'questions' && (
        <TabList
          loading={questions.loading}
          error={questions.error}
          retry={questions.refetch}
          empty="No questions yet"
          items={questions.data}
          render={(q) => (
            <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-500 capitalize">{q.type.replace('_', ' ')}</span>
                <Badge tone={q.difficulty === 'Hard' ? 'rose' : q.difficulty === 'Medium' ? 'amber' : 'emerald'}>{q.difficulty}</Badge>
              </div>
              <p className="text-xs font-semibold text-slate-900">{q.questionText}</p>
              <div className="text-[11px] text-slate-500">{q.marks} marks</div>
            </div>
          )}
        />
      )}

      {tab === 'quizzes' && (
        <TabList
          loading={quizzes.loading}
          error={quizzes.error}
          retry={quizzes.refetch}
          empty="No quizzes yet"
          items={quizzes.data}
          render={(z) => (
            <div key={z.id} className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{z.title}</h4>
                  <StatusPill status={z.status} />
                </div>
                <p className="text-[11px] text-slate-400">
                  {z.questionCount} questions • {z.durationMinutes}m • {deadlineLabel(z.deadline)}
                </p>
              </div>
              {isLeader ? (
                <button
                  onClick={() => navigate(`/leader/quizzes/${z.id}/analytics`)}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold shrink-0"
                >
                  Analytics
                </button>
              ) : z.availability?.open ? (
                <Link to={`/member/quizzes/${z.id}`} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shrink-0">
                  Start
                </Link>
              ) : (
                <span className="text-[11px] text-slate-400 shrink-0">{z.availability?.reason}</span>
              )}
            </div>
          )}
        />
      )}

      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Enrolled members ({members.data?.length ?? c.memberCount})
            </h2>
            <button
              onClick={() => setShowEnroll(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Add member
            </button>
          </div>
          {members.loading && <LoadingState className="py-8" />}
          {!members.loading && members.error && (
            <ErrorState error={members.error} onRetry={members.refetch} />
          )}
          {!members.loading && !members.error && (members.data?.length ?? 0) === 0 && (
            <EmptyState
              icon="group_add"
              title="No members enrolled"
              description="Add a registered member by email."
              className="border-0"
            />
          )}
          {!members.error && (members.data?.length ?? 0) > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Member</th>
                    <th className="p-3">Number</th>
                    <th className="p-3">Enrolled</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Average</th>
                    <th className="p-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(members.data || []).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[10px] text-slate-400">{s.email}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{s.memberNumber || '—'}</td>
                      <td className="p-3 text-slate-500">{formatDate(s.enrolledAt)}</td>
                      <td className="p-3 text-slate-600">{s.attemptsCount}</td>
                      <td className="p-3 font-bold text-slate-900">{s.averageScore != null ? `${s.averageScore}%` : '—'}</td>
                      <td className="p-3">
                        <button
                          title={`Remove ${s.name}`}
                          onClick={async () => {
                            try {
                              await Courses.unenroll(c.id, s.id);
                              members.refetch();
                              course.refetch();
                            } catch (err) {
                              toast.error(err instanceof ApiError ? err.message : 'Could not remove member');
                            }
                          }}
                          className="text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">person_remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showEnroll && (
        <EnrollModal
          courseId={c.id}
          onClose={() => setShowEnroll(false)}
          onDone={() => {
            setShowEnroll(false);
            members.refetch();
            course.refetch();
            toast.success('Member enrolled');
          }}
        />
      )}
    </div>
  );
}

function EnrollModal({
  courseId,
  onClose,
  onDone,
}: {
  courseId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const enroll = useMutation(Courses.enroll);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await enroll.mutate(courseId, email.trim());
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not enrol that member');
    }
  };
  return (
    <Modal title="Add a member" icon="person_add" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-xs">
        <p className="text-slate-500">
          The member must already have a Gisozi Youth Mass Choir Quiz account.
        </p>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Member email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300"
          />
        </label>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={enroll.loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold flex items-center gap-2"
          >
            {enroll.loading && <Spinner />}
            Enrol
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TabList<T>({
  loading,
  error,
  retry,
  empty,
  items,
  render,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
  empty: string;
  items: T[] | undefined;
  render: (item: T) => ReactElement;
}) {
  if (loading) return <LoadingState className="py-10" />;
  if (error) return <ErrorState error={error as { message?: string }} onRetry={retry} />;
  if (!items || items.length === 0) return <EmptyState icon="inbox" title={empty} />;
  return <div className="space-y-2.5">{items.map(render)}</div>;
}
