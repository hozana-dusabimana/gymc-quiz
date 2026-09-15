import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Courses } from '@/lib/services';
import { PageHeader, Modal } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { Course } from '@/types';

function courseHaystack(c: Course): string {
  return [c.code, c.title, c.description, c.department, c.term, c.instructorName, c.campus]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Every whitespace-separated term must appear somewhere in the course. */
function matchesQuery(c: Course, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = courseHaystack(c);
  return terms.every((t) => hay.includes(t));
}

function sortCourses(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

export function CoursesPage() {
  const { user } = useAuth();
  const isLeader = user?.role === 'leader';
  const { data, loading, error, refetch } = useQuery(() => Courses.list(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');

  const allCourses = useMemo(() => sortCourses(data || []), [data]);
  const courses = useMemo(
    () => allCourses.filter((c) => matchesQuery(c, query)),
    [allCourses, query],
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={isLeader ? 'Courses' : 'My courses'}
        subtitle={isLeader ? 'Courses you lead' : 'Courses you are enrolled in'}
        actions={
          isLeader && (
            <button
              onClick={() => setShowCreate(true)}
              data-tour="new-course"
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New course
            </button>
          )
        }
      />

      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          icon="school"
          title={isLeader ? 'No courses yet' : 'You are not enrolled in any courses'}
          description={isLeader ? 'Create a course to get started.' : 'Ask your leader to enrol you in a course.'}
        />
      )}

      {!loading && !error && allCourses.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter courses…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear filter"
                className="material-symbols-outlined text-base text-slate-400 hover:text-slate-700 absolute right-3 top-1/2 -translate-y-1/2"
              >
                close
              </button>
            )}
          </div>
          {query && (
            <span className="text-[11px] font-medium text-slate-400">
              {courses.length} of {allCourses.length}
            </span>
          )}
        </div>
      )}

      {!loading && !error && allCourses.length > 0 && courses.length === 0 && (
        <EmptyState
          icon="search_off"
          title="No matching courses"
          description={`Nothing matches "${query}". Try a course code or title.`}
        />
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-mono">
                    {course.code}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <span className="material-symbols-outlined text-sm">folder</span>
                    {course.department || 'Course'}
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-2 mt-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {course.description || course.department || 'No description'}
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-bold text-slate-900">{course.memberCount}</div>
                  <div className="text-[10px] text-slate-400">members</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{course.materialsCount}</div>
                  <div className="text-[10px] text-slate-400">materials</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{course.activeQuizzesCount}</div>
                  <div className="text-[10px] text-slate-400">quizzes</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCourseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ code: '', title: '', description: '', department: '', term: '', schedule: '', room: '' });
  const { mutate, loading } = useMutation(Courses.create);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutate(form);
      toast.success('Course created');
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create course');
    }
  };

  return (
    <Modal title="Create course" icon="add_business" onClose={onClose} wide>
      <form id="create-course-form" onSubmit={submit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Course code *</span>
            <input required value={form.code} onChange={set('code')} placeholder="THEORY101" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-semibold text-slate-700 block mb-1">Title *</span>
            <input required value={form.title} onChange={set('title')} placeholder="Music Theory Basics" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
        </div>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Description</span>
          <textarea value={form.description} onChange={set('description')} rows={2} className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Department</span>
            <input value={form.department} onChange={set('department')} placeholder="Choir" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Term</span>
            <input value={form.term} onChange={set('term')} placeholder="2026" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Schedule</span>
            <input value={form.schedule} onChange={set('schedule')} placeholder="Sat 15:00" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Room</span>
            <input value={form.room} onChange={set('room')} placeholder="Choir Room" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {loading && <Spinner />}
            Create course
          </button>
        </div>
      </form>
    </Modal>
  );
}
