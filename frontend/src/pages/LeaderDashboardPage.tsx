import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { Analytics, Courses, Quizzes, Users } from '@/lib/services';
import { PageHeader, StatCard, StatusPill, TrendChip } from '@/components/common';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { pct, timeAgo } from '@/lib/format';
import type { LeaderStats } from '@/types';

export function LeaderDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const stats = useQuery(() => Users.stats<LeaderStats>(), []);
  const courses = useQuery(() => Courses.list(), []);
  const quizzes = useQuery(() => Quizzes.list(), []);
  const overview = useQuery(() => Analytics.overview(), []);

  const s = stats.data;
  const sortedCourses = [...(courses.data || [])].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Choir leader workspace"
        subtitle={`${user?.prefix ? user.prefix + ' ' : ''}${user?.name}${
          s?.department ? ` • ${s.department}` : ''
        } • Assessment management portal`}
        actions={
          <>
            <button
              onClick={() => navigate('/leader/quizzes/new')}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/25 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              Create quiz
            </button>
            <Link
              to="/leader/materials"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-amber-600">upload_file</span>
              Upload material
            </Link>
            <Link
              to="/leader/questions"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-amber-600">help_outline</span>
              Question bank
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.loading ? (
          <div className="col-span-full">
            <LoadingState className="py-8" />
          </div>
        ) : (
          <>
            <StatCard
              label="Total courses"
              value={s?.courses ?? 0}
              icon="school"
              tone="gold"
            />
            <StatCard
              label="Active quizzes"
              value={s?.activeQuizzes ?? 0}
              hint={s?.quizzesClosingSoon ? `${s.quizzesClosingSoon} closing in 48h` : undefined}
              icon="assignment"
              tone="amber"
            />
            <StatCard
              label="Choir members"
              value={s?.members ?? 0}
              hint={
                s?.membersJoinedThisWeek ? (
                  <span className="text-emerald-600 font-semibold">+{s.membersJoinedThisWeek} this week</span>
                ) : undefined
              }
              icon="groups"
              tone="purple"
            />
            <StatCard
              label="Average score"
              value={s?.averageScore != null ? pct(s.averageScore, 1) : '—'}
              hint={<TrendChip delta={s?.trends?.averageScore} unit=" pts" />}
              icon="trending_up"
              tone="emerald"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">quiz</span>
              Published &amp; active assessments
            </h2>
            <button
              onClick={() => navigate('/leader/quizzes/new')}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              + New quiz
            </button>
          </div>

          {quizzes.loading && <LoadingState className="py-8" />}
          {quizzes.error && <ErrorState error={quizzes.error} onRetry={quizzes.refetch} />}
          {!quizzes.loading && (quizzes.data?.length ?? 0) === 0 && (
            <EmptyState
              icon="assignment"
              title="No quizzes yet"
              description="Create your first assessment from the question bank."
              action={
                <button
                  onClick={() => navigate('/leader/quizzes/new')}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold"
                >
                  Create quiz
                </button>
              }
            />
          )}

          <div className="space-y-3">
            {(quizzes.data || []).map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-all shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono">
                        {quiz.courseCode}
                      </span>
                      <StatusPill status={quiz.status} />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm md:text-base">{quiz.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/leader/quizzes/${quiz.id}/analytics`)}
                      className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">query_stats</span>
                      Analytics
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Submissions</span>
                    <div className="font-bold text-slate-900 mt-0.5">{quiz.submissionsCount}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Average</span>
                    <div className="font-bold text-emerald-600 mt-0.5">{pct(quiz.averageScore)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Duration</span>
                    <div className="font-bold text-slate-900 mt-0.5">{quiz.durationMinutes} min</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Questions</span>
                    <div className="font-bold text-slate-700 mt-0.5">{quiz.questionCount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-amber-600">bolt</span>
              Recent submissions
            </h2>
            {overview.loading && <LoadingState className="py-6" />}
            {!overview.loading && (overview.data?.recentSubmissions?.length ?? 0) === 0 && (
              <EmptyState icon="how_to_reg" title="No submissions yet" className="border-0 py-6" />
            )}
            <div className="space-y-2">
              {(overview.data?.recentSubmissions || []).map((sub) => {
                const initials = sub.memberName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <Link
                    key={sub.id}
                    to={`/leader/results/${sub.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 transition-all"
                  >
                    {sub.memberAvatar ? (
                      <img src={sub.memberAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{sub.memberName}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {sub.courseCode} • {sub.quizTitle} • {timeAgo(sub.completedAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-extrabold ${
                          (sub.percentage ?? 0) >= 50 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {pct(sub.percentage)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {sub.score}/{sub.maxScore}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {overview.data?.syllabusInsight && (
            <div className="bg-gradient-to-br from-amber-800 via-amber-900 to-slate-950 text-white rounded-2xl p-5 shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">auto_awesome</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-200">Material insight</h3>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                From your recent material{' '}
                <strong className="text-white">"{overview.data.syllabusInsight.materialTitle}"</strong> (
                {overview.data.syllabusInsight.courseCode}),{' '}
                <strong className="text-white">
                  {overview.data.syllabusInsight.aiQuestionCount} AI question
                  {overview.data.syllabusInsight.aiQuestionCount === 1 ? '' : 's'}
                </strong>{' '}
                {overview.data.syllabusInsight.aiQuestionCount === 1 ? 'was' : 'were'} generated{' '}
                {timeAgo(overview.data.syllabusInsight.uploadedAt)}.
              </p>
              <Link
                to="/leader/questions?aiGenerated=true"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200 hover:text-white"
              >
                Review in question bank
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-amber-600">school</span>
              Your courses
            </h2>
            {courses.loading && <LoadingState className="py-8" />}
            {!courses.loading && (courses.data?.length ?? 0) === 0 && (
              <EmptyState
                icon="school"
                title="No courses yet"
                description="Create a course to get started."
                className="border-0 py-6"
                action={
                  <Link to="/leader/courses" className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">
                    Go to courses
                  </Link>
                }
              />
            )}
            <div className="space-y-1 rounded-xl bg-white border border-slate-200 p-3">
              {sortedCourses.map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[11px] font-semibold text-slate-700 truncate">
                    <span className="font-mono text-slate-400">{course.code}</span> · {course.title}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{course.memberCount}👤</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}