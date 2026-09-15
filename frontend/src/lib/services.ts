import { http } from './api';
import type {
  Attempt,
  AttemptView,
  Course,
  CourseMaterial,
  CourseMember,
  Evaluation,
  LeaderStats,
  Question,
  Quiz,
  RecentSubmission,
  MemberStats,
  SyllabusInsight,
  UserNotification,
} from '@/types';

// ---- courses ----
export const Courses = {
  list: () => http.get<{ courses: Course[] }>('/courses').then((r) => r.courses),
  get: (id: string) => http.get<{ course: Course }>(`/courses/${id}`).then((r) => r.course),
  create: (body: Partial<Course>) =>
    http.post<{ course: Course }>('/courses', body),
  update: (id: string, body: Partial<Course>) =>
    http.patch<{ course: Course }>(`/courses/${id}`, body).then((r) => r.course),
  remove: (id: string) => http.del(`/courses/${id}`),
  members: (id: string) =>
    http.get<{ members: CourseMember[] }>(`/courses/${id}/members`).then((r) => r.members),
  enroll: (id: string, email: string) => http.post(`/courses/${id}/enroll`, { email }),
  unenroll: (id: string, memberId: string) => http.del(`/courses/${id}/members/${memberId}`),
  analytics: (id: string) =>
    http.get<{ quizzes: any[]; distribution: any }>(`/courses/${id}/analytics`),
};

// ---- materials ----
export const Materials = {
  list: (courseId: string) =>
    http.get<{ materials: CourseMaterial[] }>(`/materials?courseId=${courseId}`).then((r) => r.materials),
  get: (id: string) => http.get<{ material: CourseMaterial }>(`/materials/${id}`).then((r) => r.material),
  upload: (courseId: string, file: File, title?: string) => {
    const form = new FormData();
    form.append('courseId', courseId);
    form.append('file', file);
    if (title) form.append('title', title);
    return http.upload<{ material: CourseMaterial }>('/materials', form).then((r) => r.material);
  },
  reprocess: (id: string) =>
    http.post<{ material: CourseMaterial }>(`/materials/${id}/reprocess`).then((r) => r.material),
  generateQuestions: (id: string, body: { count: number; difficulty?: string; types?: string[] }) =>
    http.post<{ questions: Question[] }>(`/materials/${id}/generate-questions`, body).then((r) => r.questions),
  remove: (id: string) => http.del(`/materials/${id}`),
  downloadUrl: (id: string) =>
    http.get<{ url: string; filename: string }>(`/materials/${id}/download`),
};

// ---- questions ----
export const Questions = {
  list: (params: { courseId?: string; type?: string; difficulty?: string; search?: string; materialId?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v && v !== 'all') as [string, string][],
    ).toString();
    return http.get<{ questions: Question[] }>(`/questions${qs ? `?${qs}` : ''}`).then((r) => r.questions);
  },
  get: (id: string) => http.get<{ question: Question }>(`/questions/${id}`).then((r) => r.question),
  create: (body: any) => http.post<{ question: Question }>('/questions', body).then((r) => r.question),
  update: (id: string, body: any) =>
    http.patch<{ question: Question }>(`/questions/${id}`, body).then((r) => r.question),
  remove: (id: string) => http.del(`/questions/${id}`),

  // ---- AI-assisted import (any readable file format, or pasted text) ----
  importParse: (input: { file?: File; text?: string; hint?: string }) => {
    if (input.file) {
      const form = new FormData();
      form.append('file', input.file);
      if (input.hint) form.append('hint', input.hint);
      return http.upload<QuestionImportResult>('/questions/import/parse', form);
    }
    return http.post<QuestionImportResult>('/questions/import/parse', {
      text: input.text || '',
      hint: input.hint || '',
    });
  },
  importCommit: (body: { courseId: string; materialId?: string | null; drafts: QuestionDraft[] }) =>
    http.post<{ created: Question[]; skipped: { index: number; questionText: string; reason: string }[]; importedCount: number }>(
      '/questions/import/commit',
      body,
    ),
};

export interface QuestionDraft {
  tempId: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionText: string;
  options: string[];
  correctAnswer: string;
  markingGuidance: string;
  explanation: string;
  marks: number;
  hasAnswerKey: boolean;
  include: boolean;
  issues: string[];
  status: 'ready' | 'needs_review';
}
export interface QuestionImportResult {
  drafts: QuestionDraft[];
  meta: { filename: string | null; characters: number; windows: number; pageCount: number; truncated: boolean };
  stats: { found: number; ready: number; needsReview: number; withAnswerKey: number };
}

// ---- quizzes ----
export const Quizzes = {
  list: (courseId?: string) => {
    const qs = new URLSearchParams();
    if (courseId) qs.set('courseId', courseId);
    const s = qs.toString();
    return http.get<{ quizzes: Quiz[] }>(`/quizzes${s ? `?${s}` : ''}`).then((r) => r.quizzes);
  },
  get: (id: string) =>
    http.get<{ quiz: Quiz; questions: Question[]; availability?: any }>(`/quizzes/${id}`),
  create: (body: any) =>
    http.post<{ quiz: Quiz; questions: Question[] }>('/quizzes', body),
  update: (id: string, body: any) => http.patch<{ quiz: Quiz }>(`/quizzes/${id}`, body).then((r) => r.quiz),
  setQuestions: (id: string, questions: { questionId: string; marksOverride?: number | null }[]) =>
    http.put<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}/questions`, { questions }),
  publish: (id: string) => http.post<{ quiz: Quiz }>(`/quizzes/${id}/publish`).then((r) => r.quiz),
  close: (id: string) => http.post<{ quiz: Quiz }>(`/quizzes/${id}/close`).then((r) => r.quiz),
  remove: (id: string) => http.del(`/quizzes/${id}`),
};

// ---- attempts ----
export const Attempts = {
  start: (quizId: string) => http.post<AttemptView>('/attempts', { quizId }),
  get: (id: string) => http.get<AttemptView>(`/attempts/${id}`),
  saveAnswers: (id: string, answers: { questionId: string; answerText?: string; optionId?: string }[]) =>
    http.put<{ saved: boolean }>(`/attempts/${id}/answers`, { answers }),
  submit: (id: string, timeSpentSeconds?: number) =>
    http.post<AttemptView>(`/attempts/${id}/submit`, { timeSpentSeconds }),
  mine: () => http.get<{ attempts: Attempt[] }>('/attempts/mine').then((r) => r.attempts),
  forQuiz: (quizId: string) =>
    http.get<{ attempts: Attempt[] }>(`/attempts?quizId=${quizId}`).then((r) => r.attempts),
};

// ---- results ----
export const Results = {
  mine: () => http.get<{ results: Attempt[] }>('/results/mine').then((r) => r.results),
  get: (attemptId: string) =>
    http.get<AttemptView & { evaluations: Evaluation[] }>(`/results/${attemptId}`),
};

// ---- users ----
export const Users = {
  me: () => http.get<{ user: any }>('/users/me').then((r) => r.user),
  updateProfile: (body: any) => http.patch<{ user: any }>('/users/me', body).then((r) => r.user),
  stats: <T = MemberStats | LeaderStats>() => http.get<{ stats: T }>('/users/me/stats').then((r) => r.stats),
};

// ---- notifications ----
export const Notifications = {
  list: () =>
    http.get<{ notifications: UserNotification[]; unreadCount: number }>('/notifications'),
  readAll: () => http.post('/notifications/read-all'),
  read: (id: string) => http.post(`/notifications/${id}/read`),
};

// ---- analytics ----
export interface AnalyticsReport {
  institution: { name: string; system: string };
  generatedAt: string;
  generatedBy: { name: string; email: string };
  departments: string[];
  summary: {
    courses: number;
    assessments: number;
    submissions: number;
    members: number;
    averageScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    passRate: number | null;
    belowCutoff: number;
    averageMinutes: number | null;
  };
  distribution: { a: number; b: number; c: number; d: number; total: number };
  courses: {
    code: string;
    title: string;
    department: string | null;
    quizzes: number;
    published: number;
    enrolled: number;
    submissions: number;
    averageScore: number | null;
    passRate: number | null;
  }[];
  assessments: {
    title: string;
    courseCode: string;
    status: string;
    questionCount: number;
    passingScore: number;
    deadline: string | null;
    submissions: number;
    averageScore: number | null;
    highest: number | null;
    lowest: number | null;
    passRate: number | null;
  }[];
  /** Every member with at least one graded submission across your courses — not capped to a top-N. */
  memberAverages: {
    name: string;
    memberNumber: string | null;
    attempts: number;
    averageScore: number | null;
    rank: number | null;
  }[];
}

export interface QuizMarksReport {
  institution: { name: string; system: string };
  generatedAt: string;
  generatedBy: { name: string; email: string };
  quiz: {
    title: string;
    description: string | null;
    courseCode: string;
    courseTitle: string;
    status: string;
    questionCount: number;
    totalMarks: number | null;
    passingScore: number;
    durationMinutes: number;
    opensAt: string | null;
    deadline: string | null;
    publishedAt: string | null;
  };
  summary: {
    enrolled: number;
    submitted: number;
    notAttempted: number;
    inProgress: number;
    averageScore: number | null;
    medianScore: number | null;
    highestScore: number | null;
    lowestScore: number | null;
    passed: number;
    failed: number;
    passRate: number | null;
  };
  distribution: { a: number; b: number; c: number; d: number; total: number };
  members: {
    name: string;
    memberNumber: string | null;
    email: string;
    status: 'completed' | 'in_progress' | 'not_attempted';
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
    passed: boolean | null;
    attemptNumber: number | null;
    submittedAt: string | null;
    timeSpentMinutes: number | null;
    rank: number | null;
  }[];
}

export const Analytics = {
  overview: () =>
    http.get<{
      quizzes: any[];
      distribution: any;
      hardestQuestions: any[];
      recentSubmissions: RecentSubmission[];
      syllabusInsight: SyllabusInsight | null;
    }>('/analytics/overview'),
  report: () => http.get<AnalyticsReport>('/analytics/report'),
  quizReport: (quizId: string) =>
    http.get<QuizMarksReport>(`/analytics/quiz/${quizId}/report`),
};