import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { Courses, Quizzes, Results, Users } from '@/lib/services';
import { StatCard, TrendChip } from '@/components/common';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { deadlineLabel, formatDateTime, pct } from '@/lib/format';
import type { MemberStats } from '@/types';

export function MemberDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const stats = useQuery(() => Users.stats<MemberStats>(), []);
  const courses = useQuery(() => Courses.list(), []);
  const quizzes = useQuery(() => Quizzes.list(), []);
  const results = useQuery(() => Results.mine(), []);

  const openQuizzes = (quizzes.data || []).filter((q) => q.availability?.open);
  const primary = openQuizzes[0];
  const firstName = user?.name?.split(' ')[0] || 'there';
  const s = stats.data;
  const sortedCourses = [...(courses.data || [])].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {[s?.department, s?.term].filter(Boolean).join(' • ') || 'Your courses, assessments and AI feedback'}
          </p>
        </div>
        {s?.standing && (
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              s.standing === 'Good standing'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : s.standing === 'Needs attention'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {s.standing === 'Good standing' ? 'verified' : s.standing === 'Needs attention' ? 'warning' : 'school'}
            </span>
            Status: {s.standing}
          </span>
        )}
      </div>

      {quizzes.loading ? null : primary ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white shadow-xl p-6 lg:p-8">
          <div className="absolute right-0 inset-y-0 w-1/3 opacity-10 flex items-center justify-center pointer-events-none">
            <span className="material-symbols-outlined text-[200px]">timer</span>
          </div>
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold uppercase tracking-wider">
                Available now
              </span>
              <span className="text-xs font-medium bg-white/10 px-2.5 py-1 rounded-md text-blue-100">
                {primary.courseCode} • {primary.courseTitle}
              </span>
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight">{primary.title}</h2>
              <p className="text-xs lg:text-sm text-blue-100/90 mt-1.5 leading-relaxed">
                {primary.description || 'Assessment ready to start.'}
              </p>
            </div>
            <div className="pt-1 flex flex-wrap items-center gap-4 lg:gap-6 text-xs text-blue-100">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-300">schedule</span>
                <strong>{primary.durationMinutes}</strong> mins
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-300">format_list_numbered</span>
                <strong>{primary.questionCount}</strong> questions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-300">grade</span>
                <strong>{primary.totalMarks}</strong> marks
              </span>
              <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <span className="material-symbols-outlined text-base">event_available</span>
                {deadlineLabel(primary.deadline)}
              </span>
            </div>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => navigate(`/member/quizzes/${primary.id}`)}
                className="px-6 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm rounded-xl shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                Start assessment
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
              <Link
                to={`/courses/${primary.courseId}`}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-colors"
              >
                View course
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="task_alt"
          title="No quizzes open right now"
          description="When your choir leader publishes an assessment it will appear here."
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stat-cards">
        {stats.loading ? (
          <div className="col-span-full">
            <LoadingState label="Loading stats…" className="py-8" />
          </div>
        ) : (
          <>
            <StatCard
              label="Performance index"
              value={s?.performanceIndex != null ? `${s.performanceIndex.toFixed(2)} / 4.0` : '—'}
              hint="Across graded quizzes"
              icon="school"
              tone="blue"
            />
            <StatCard
              label="Quizzes taken"
              value={s?.quizzesTaken ?? 0}
              hint={s?.completionRate != null ? `${s.completionRate}% completion rate` : undefined}
              icon="check_circle"
              tone="indigo"
            />
            <StatCard
              label="Average score"
              value={s?.averageScore != null ? pct(s.averageScore, 1) : '—'}
              hint={<TrendChip delta={s?.trends?.averageScore} unit=" pts" />}
              icon="analytics"
              tone="amber"
            />
            <StatCard
              label="Active streak"
              value={`${s?.streakDays ?? 0} ${(s?.streakDays ?? 0) === 1 ? 'day' : 'days'}`}
              hint={s?.streakLabel}
              icon="local_fire_department"
              tone="rose"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">book</span>
              Enrolled courses{s?.term ? ` (${s.term})` : ''}
            </h2>
            <Link to="/member/courses" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>

          {courses.loading && <LoadingState className="py-8" />}
          {courses.error && <ErrorState error={courses.error} onRetry={courses.refetch} />}
          {!courses.loading && !courses.error && (courses.data?.length ?? 0) === 0 && (
            <EmptyState icon="menu_book" title="You're not enrolled in any courses yet" />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedCourses.map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-mono">
                      {course.code}
                    </span>
                    {course.term && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        {course.term}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {course.description || 'No description provided.'}
                    </p>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{course.instructorName}</span>
                  <span>{course.materialsCount} materials</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">verified</span>
              Recent results
            </h2>
            <Link to="/member/results" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              Grades →
            </Link>
          </div>
          {results.loading && <LoadingState className="py-8" />}
          {!results.loading && (results.data?.length ?? 0) === 0 && (
            <EmptyState icon="grading" title="No results yet" />
          )}
          <div className="space-y-3">
            {(results.data || []).slice(0, 6).map((sub) => (
              <div
                key={sub.id}
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {sub.courseCode}
                    </span>
                    <h3 className="font-bold text-xs text-slate-900 mt-1 line-clamp-1">{sub.quizTitle}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-base font-extrabold ${
                        (sub.percentage ?? 0) >= (sub.passingScore ?? 50) ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {pct(sub.percentage)}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {sub.score}/{sub.maxScore} pts
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span className="text-[11px]">{formatDateTime(sub.completedAt)}</span>
                  <Link
                    to={`/member/results/${sub.id}`}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                  >
                    Review feedback →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}