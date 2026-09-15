/** Row -> API shape mappers. Keep field names camelCase and close to the
 *  frontend's existing type definitions to minimise UI churn. */

export function course(r, extra = {}) {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description || '',
    department: r.department || '',
    term: r.term || '',
    leaderId: r.leader_id,
    instructorName: r.instructor_name || extra.instructorName || '',
    instructorAvatar: r.instructor_avatar || extra.instructorAvatar || null,
    schedule: r.schedule || '',
    room: r.room || '',
    color: r.color || 'from-blue-600 to-indigo-700',
    campus: r.campus || null,
    credits: r.credits != null ? Number(r.credits) : null,
    status: r.status,
    startDate: r.start_date || null,
    endDate: r.end_date || null,
    memberCount: num(r.member_count ?? extra.memberCount),
    materialsCount: num(r.materials_count ?? extra.materialsCount),
    questionsCount: num(r.questions_count ?? extra.questionsCount),
    activeQuizzesCount: num(r.active_quizzes_count ?? extra.activeQuizzesCount),
    averageScore: r.average_score != null ? round1(r.average_score) : null,
    enrolled: extra.enrolled ?? undefined,
    createdAt: r.created_at,
  };
}

export function material(r) {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    filename: r.filename,
    fileType: r.file_type,
    fileSize: num(r.file_size),
    size: humanSize(num(r.file_size)),
    storageUrl: r.storage_url || null,
    pageCount: num(r.page_count),
    pagesCount: num(r.page_count),
    chunkCount: num(r.chunk_count),
    summary: r.summary || '',
    status: r.status,
    errorMessage: r.error_message || null,
    questionsGenerated: num(r.questions_generated),
    uploadedAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function question(r, options = []) {
  return {
    id: r.id,
    courseId: r.course_id,
    courseCode: r.course_code || undefined,
    type: r.type,
    difficulty: r.difficulty,
    questionText: r.question_text,
    options: options.map((o) => o.content),
    optionRows: options.map((o) => ({ id: o.id, content: o.content, position: o.position, isCorrect: o.is_correct })),
    correctAnswer: r.correct_answer || '',
    markingGuidance: r.marking_guidance || '',
    marks: num(r.marks),
    explanation: r.explanation || '',
    materialId: r.material_id || null,
    materialPage: r.material_page || null,
    materialRef: r.material_id
      ? {
          materialId: r.material_id,
          name: r.material_filename || r.material_title || 'Course material',
          page: r.material_page || 1,
          snippet: r.material_summary ? String(r.material_summary).slice(0, 200) : '',
          topic: r.material_title || undefined,
        }
      : undefined,
    tags: r.tags || [],
    aiGenerated: r.ai_generated || false,
    quizzesUsedCount: num(r.quizzes_used_count),
    createdAt: r.created_at,
  };
}

export function quiz(r, extra = {}) {
  return {
    id: r.id,
    courseId: r.course_id,
    courseCode: r.course_code || extra.courseCode || '',
    courseTitle: r.course_title || extra.courseTitle || '',
    title: r.title,
    description: r.description || '',
    durationMinutes: num(r.duration_minutes),
    passingScore: num(r.passing_score),
    totalMarks: num(r.total_marks ?? extra.totalMarks),
    questionCount: num(r.question_count ?? extra.questionCount),
    status: r.status,
    randomizeOrder: r.randomize_order,
    showInstantFeedback: r.show_instant_feedback,
    attemptsAllowed: num(r.attempts_allowed),
    opensAt: r.opens_at || null,
    deadline: r.deadline || null,
    submissionsCount: num(r.submissions_count ?? extra.submissionsCount),
    averageScore: r.average_score != null ? round1(r.average_score) : (extra.averageScore ?? null),
    publishedAt: r.published_at || null,
    createdAt: r.created_at,
    // member-facing attempt hints (added by the route when relevant)
    myAttempts: extra.myAttempts,
    attemptsRemaining: extra.attemptsRemaining,
    lastAttempt: extra.lastAttempt,
    availability: extra.availability,
  };
}

export function attempt(r, extra = {}) {
  return {
    id: r.id,
    quizId: r.quiz_id,
    quizTitle: r.quiz_title || extra.quizTitle,
    courseCode: r.course_code || extra.courseCode,
    memberId: r.member_id,
    memberName: r.member_name || extra.memberName,
    memberEmail: r.member_email || extra.memberEmail,
    memberNumber: r.member_number || extra.memberNumber || null,
    attemptNumber: num(r.attempt_number),
    status: r.status,
    startedAt: r.started_at,
    mustSubmitBy: r.must_submit_by,
    submittedAt: r.submitted_at || null,
    completedAt: r.completed_at || null,
    score: r.score != null ? Number(r.score) : null,
    maxScore: r.max_score != null ? Number(r.max_score) : null,
    percentage: r.percentage != null ? round1(r.percentage) : null,
    timeSpentSeconds: r.time_spent_seconds || null,
    timeSpentMinutes: r.time_spent_seconds ? Math.max(1, Math.round(r.time_spent_seconds / 60)) : null,
    aiSummary: r.ai_summary || null,
    questionOrder: r.question_order || [],
  };
}

export function notification(r) {
  return {
    id: r.id,
    title: r.title,
    message: r.message || '',
    type: r.type,
    linkTarget: r.link_target || null,
    read: r.read,
    time: r.created_at,
    createdAt: r.created_at,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round1(v) {
  return Math.round(Number(v) * 10) / 10;
}
function humanSize(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
