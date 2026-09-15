export type UserRole = 'member' | 'leader';
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface User {
  id: string;
  role: UserRole;
  email: string;
  name: string;
  phone?: string | null;
  prefix?: string | null;
  avatarUrl?: string | null;
  memberNumber?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  department: string;
  term: string;
  leaderId: string;
  instructorName: string;
  instructorAvatar?: string | null;
  schedule: string;
  room: string;
  color: string;
  campus?: string | null;
  credits?: number | null;
  status: string;
  memberCount: number;
  materialsCount: number;
  questionsCount: number;
  activeQuizzesCount: number;
  averageScore: number | null;
  enrolled?: boolean;
  createdAt: string;
}

export interface MemberStats {
  courses: number;
  quizzesTaken: number;
  averageScore: number | null;
  availableQuizzes: number;
  completionRate: number | null;
  performanceIndex: number | null;
  cohortPercentile: number | null;
  streakDays: number;
  streakLabel: string;
  department: string | null;
  term: string | null;
  standing: string;
  trends: { averageScore: number | null; quizzesTaken: number | null };
}

export interface LeaderStats {
  courses: number;
  activeQuizzes: number;
  quizzesClosingSoon: number;
  members: number;
  membersJoinedThisWeek: number;
  averageScore: number | null;
  department: string | null;
  trends: { averageScore: number | null };
}

export interface RecentSubmission {
  id: string;
  memberName: string;
  memberAvatar: string | null;
  quizTitle: string;
  courseCode: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  completedAt: string;
}

export interface SyllabusInsight {
  materialId: string;
  materialTitle: string;
  courseCode: string;
  uploadedAt: string;
  aiQuestionCount: number;
}

export interface QuestionMaterialRef {
  materialId?: string;
  name: string;
  page: number;
  snippet: string;
  topic?: string;
}

export interface Question {
  id: string;
  courseId: string;
  courseCode?: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  questionText: string;
  options: string[];
  optionRows?: { id: string; content: string; position: number; isCorrect: boolean }[];
  correctAnswer: string;
  markingGuidance?: string;
  marks: number;
  explanation: string;
  materialId?: string | null;
  materialPage?: number | null;
  materialRef?: QuestionMaterialRef;
  tags: string[];
  aiGenerated?: boolean;
  quizzesUsedCount: number;
  createdAt: string;
  position?: number;
}

export type MaterialStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  size: string;
  storageUrl?: string | null;
  pageCount: number;
  pagesCount: number;
  chunkCount: number;
  summary: string;
  status: MaterialStatus;
  errorMessage?: string | null;
  questionsGenerated: number;
  uploadedAt: string;
  updatedAt: string;
}

export type QuizStatus = 'draft' | 'published' | 'closed';

export interface QuizAvailability {
  open: boolean;
  reason: string | null;
  hasInProgress?: boolean;
  completedCount?: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  totalMarks: number;
  questionCount: number;
  status: QuizStatus;
  randomizeOrder: boolean;
  showInstantFeedback: boolean;
  attemptsAllowed: number;
  opensAt?: string | null;
  deadline?: string | null;
  submissionsCount: number;
  averageScore: number | null;
  publishedAt?: string | null;
  createdAt: string;
  myAttempts?: number;
  attemptsRemaining?: number;
  lastAttempt?: Attempt | null;
  availability?: QuizAvailability;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'evaluating' | 'completed' | 'failed';

export interface Attempt {
  id: string;
  quizId: string;
  quizTitle?: string;
  courseCode?: string;
  memberId: string;
  memberName?: string;
  memberEmail?: string;
  memberNumber?: string | null;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  mustSubmitBy: string;
  submittedAt?: string | null;
  completedAt?: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  timeSpentSeconds?: number | null;
  timeSpentMinutes?: number | null;
  aiSummary?: string | null;
  questionOrder?: string[];
  passingScore?: number;
  courseTitle?: string;
  passed?: boolean | null;
}

export interface AttemptQuestion {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  questionText: string;
  options: string[];
  marks: number;
  yourAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  materialRef?: QuestionMaterialRef;
  isCorrect?: boolean | null;
  score?: number | null;
  maxScore?: number | null;
}

export interface AnswerReference {
  kind: 'material' | 'online';
  title: string;
  page?: number | null;
  snippet?: string;
  url?: string | null;
  materialId?: string | null;
}

export interface Evaluation {
  questionId: string;
  type: QuestionType;
  questionText: string;
  yourAnswer: string;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  gradedBy: 'auto' | 'ai' | null;
  explanation: string;
  correctAnswer: string;
  aiEvaluation: string | null;
  aiFeedback: string | null;
  references: AnswerReference[];
}

export interface AttemptView {
  attempt: Attempt;
  quiz: Quiz;
  questions: AttemptQuestion[];
  secondsRemaining: number;
  availability?: { open: boolean; reason: string | null };
  evaluations?: Evaluation[];
}

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  type: 'quiz' | 'grade' | 'material' | 'system';
  linkTarget?: string | null;
  read: boolean;
  time: string;
  createdAt: string;
}

export interface CourseMember {
  id: string;
  name: string;
  email: string;
  memberNumber?: string | null;
  phone?: string | null;
  enrolledAt: string;
  averageScore: number | null;
  attemptsCount: number;
}