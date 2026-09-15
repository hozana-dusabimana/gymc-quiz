import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoadingState } from './components/ui/States';
import { AppLayout } from './components/layout/AppLayout';
import { LoginScreen } from './components/LoginScreen';
import { HomePage } from './pages/HomePage';
import { TermsPage, PrivacyPage } from './pages/PolicyPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

import { MemberDashboardPage } from './pages/MemberDashboardPage';
import { LeaderDashboardPage } from './pages/LeaderDashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseWorkspacePage } from './pages/CourseWorkspacePage';
import { MaterialsPage } from './pages/MaterialsPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { QuestionImportPage } from './pages/QuestionImportPage';
import { QuizCreatorPage } from './pages/QuizCreatorPage';
import { QuizzesPage } from './pages/QuizzesPage';
import { QuizInstructionsPage } from './pages/QuizInstructionsPage';
import { QuizTakingPage } from './pages/QuizTakingPage';
import { ResultsPage } from './pages/ResultsPage';
import { ResultDetailPage } from './pages/ResultDetailPage';
import { QuizAnalyticsPage } from './pages/QuizAnalyticsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AnalyticsReportPage } from './pages/AnalyticsReportPage';
import { QuizReportPage } from './pages/QuizReportPage';
import { ProfilePage } from './pages/ProfilePage';
import type { ReactElement } from 'react';
import type { User, UserRole } from './types';

/** Home for the current user's role. */
function homePath(user: User): string {
  if (user.role === 'member') return '/member';
  if (user.role === 'admin') return '/admin';
  return '/leader';
}

function RequireAuth({ role, children }: { role?: UserRole; children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Loading your workspace…" className="min-h-screen" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && user.role !== role) {
    return <Navigate to={homePath(user)} replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading ? (
            <LoadingState className="min-h-screen" />
          ) : user ? (
            <Navigate to={homePath(user)} replace />
          ) : (
            <HomePage />
          )
        }
      />

      <Route
        path="/login"
        element={
          loading ? (
            <LoadingState className="min-h-screen" />
          ) : user ? (
            <Navigate to={homePath(user)} replace />
          ) : (
            <LoginScreen />
          )
        }
      />

      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* Quiz taking is full-screen (no sidebar) */}
      <Route
        path="/member/attempt/:attemptId"
        element={
          <RequireAuth role="member">
            <QuizTakingPage />
          </RequireAuth>
        }
      />

      {/* Printable reports — full-screen documents (no app chrome) */}
      <Route
        path="/leader/analytics/report"
        element={
          <RequireAuth role="leader">
            <AnalyticsReportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/leader/quizzes/:quizId/report"
        element={
          <RequireAuth role="leader">
            <QuizReportPage />
          </RequireAuth>
        }
      />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        {/* member */}
        <Route path="/member" element={<RequireAuth role="member"><MemberDashboardPage /></RequireAuth>} />
        <Route path="/member/courses" element={<RequireAuth role="member"><CoursesPage /></RequireAuth>} />
        <Route path="/member/quizzes" element={<RequireAuth role="member"><QuizzesPage /></RequireAuth>} />
        <Route path="/member/quizzes/:quizId" element={<RequireAuth role="member"><QuizInstructionsPage /></RequireAuth>} />
        <Route path="/member/results" element={<RequireAuth role="member"><ResultsPage /></RequireAuth>} />
        <Route path="/member/results/:attemptId" element={<RequireAuth role="member"><ResultDetailPage /></RequireAuth>} />

        {/* leader */}
        <Route path="/leader" element={<RequireAuth role="leader"><LeaderDashboardPage /></RequireAuth>} />
        <Route path="/leader/courses" element={<RequireAuth role="leader"><CoursesPage /></RequireAuth>} />
        <Route path="/leader/materials" element={<RequireAuth role="leader"><MaterialsPage /></RequireAuth>} />
        <Route path="/leader/questions" element={<RequireAuth role="leader"><QuestionBankPage /></RequireAuth>} />
        <Route path="/leader/questions/import" element={<RequireAuth role="leader"><QuestionImportPage /></RequireAuth>} />
        <Route path="/leader/quizzes/new" element={<RequireAuth role="leader"><QuizCreatorPage /></RequireAuth>} />
        <Route path="/leader/analytics" element={<RequireAuth role="leader"><AnalyticsPage /></RequireAuth>} />
        <Route path="/leader/quizzes/:quizId/analytics" element={<RequireAuth role="leader"><QuizAnalyticsPage /></RequireAuth>} />
        <Route path="/leader/results/:attemptId" element={<RequireAuth role="leader"><ResultDetailPage /></RequireAuth>} />

        {/* admin */}
        <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboardPage /></RequireAuth>} />

        {/* shared */}
        <Route path="/courses/:courseId" element={<CourseWorkspacePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={user ? homePath(user) : '/'} replace />}
      />
    </Routes>
  );
}