import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Analytics } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { formatDate, formatDateTime } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Graded',
  in_progress: 'In progress',
  not_attempted: 'Absent',
};

function gradeLetter(p: number | null): string {
  if (p == null) return '—';
  if (p >= 90) return 'A';
  if (p >= 75) return 'B';
  if (p >= 60) return 'C';
  return 'D';
}

export function QuizReportPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(() => Analytics.quizReport(quizId!), [quizId]);

  useEffect(() => {
    document.title = 'GYMC Quiz — Quiz Marks Sheet';
    return () => {
      document.title = 'Gisozi Youth Mass Choir Quiz';
    };
  }, []);

  if (loading) return <LoadingState label="Compiling marks sheet…" className="min-h-screen" />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} className="min-h-screen" />;

  const { quiz: z, summary: s, distribution: d } = data;
  const bands = [
    { label: 'A — Distinction (90–100%)', count: d.a },
    { label: 'B — Merit (75–89%)', count: d.b },
    { label: 'C — Pass (60–74%)', count: d.c },
    { label: 'D — Below expectation (<60%)', count: d.d },
  ].map((b) => ({ ...b, percent: d.total ? Math.round((b.count / d.total) * 100) : 0 }));

  return (
    <div className="min-h-screen bg-slate-200/70 print:bg-white">
      <style>{`
        .report-sheet, .report-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { size: A4; margin: 16mm 14mm 22mm; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .report-sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; padding: 0 !important; }
          section, tr, thead { break-inside: avoid; }
          thead { display: table-header-group; }
          .report-body { font-size: 10.5px; }
        }
      `}</style>

      {/* toolbar — screen only */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white border-b border-slate-200 px-4 py-3">
        <button
          onClick={() => navigate(`/leader/quizzes/${quizId}/analytics`)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-amber-600"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back to quiz analytics
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
          >
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">print</span> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="mx-auto my-6 print:my-0 bg-white shadow-xl report-sheet w-[210mm] max-w-full p-[16mm] print:p-0">
        {/* ---- header ---- */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-700 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
              U
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                {data.institution.name}
              </h1>
              <p className="text-xs text-slate-500 font-semibold">{data.institution.system}</p>
              <p className="mt-2 text-sm font-bold text-amber-700 uppercase tracking-wide">
                Quiz Marks Sheet
              </p>
            </div>
          </div>
          <table className="text-[11px] text-slate-600 shrink-0">
            <tbody>
              <tr>
                <td className="pr-3 font-semibold text-slate-400 align-top">Prepared by</td>
                <td className="font-semibold text-slate-800">{data.generatedBy.name}</td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-400 align-top">Email</td>
                <td>{data.generatedBy.email}</td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-400 align-top">Generated</td>
                <td>{formatDateTime(data.generatedAt)}</td>
              </tr>
            </tbody>
          </table>
        </header>

        <div className="report-body space-y-6 pt-6 text-slate-800">
          {/* ---- assessment identity ---- */}
          <section>
            <SectionTitle n={1} title="Assessment" />
            <h3 className="text-base font-extrabold text-slate-900">{z.title}</h3>
            <table className="mt-2 w-full text-[11px] border border-slate-200">
              <tbody>
                <Row label="Course">
                  <span className="font-mono font-bold">{z.courseCode}</span> — {z.courseTitle}
                </Row>
                <Row label="Questions">{z.questionCount}</Row>
                <Row label="Total marks">{z.totalMarks ?? '—'}</Row>
                <Row label="Pass mark">{z.passingScore}%</Row>
                <Row label="Duration">{z.durationMinutes} min</Row>
                <Row label="Deadline">{z.deadline ? formatDateTime(z.deadline) : 'No deadline'}</Row>
                <Row label="Status">
                  <span className="capitalize">{z.status}</span>
                </Row>
              </tbody>
            </table>
          </section>

          {/* ---- result summary ---- */}
          <section>
            <SectionTitle n={2} title="Result summary" />
            <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              <Fig label="Enrolled" value={s.enrolled} />
              <Fig label="Sat the quiz" value={s.submitted} />
              <Fig label="Absent" value={s.notAttempted} />
              <Fig label="Average score" value={s.averageScore != null ? `${s.averageScore}%` : '—'} />
              <Fig label="Median" value={s.medianScore != null ? `${s.medianScore}%` : '—'} />
              <Fig label="Pass rate" value={s.passRate != null ? `${s.passRate}%` : '—'} />
              <Fig label="Highest" value={s.highestScore != null ? `${s.highestScore}%` : '—'} />
              <Fig label="Lowest" value={s.lowestScore != null ? `${s.lowestScore}%` : '—'} />
              <Fig label="Passed / Failed" value={`${s.passed} / ${s.failed}`} />
            </div>
            {s.inProgress > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                {s.inProgress} attempt{s.inProgress === 1 ? '' : 's'} still in progress — not counted in the figures above.
              </p>
            )}
            {s.submitted === 0 && (
              <p className="mt-2 text-xs text-slate-500 italic">
                No graded submissions yet — the marks sheet will populate once members complete the quiz.
              </p>
            )}
          </section>

          {/* ---- grade distribution ---- */}
          <section>
            <SectionTitle n={3} title="Grade distribution" />
            <table className="w-full text-[11px] border border-slate-200">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <Th>Band</Th>
                  <Th className="text-right w-24">Members</Th>
                  <Th className="text-right w-20">Share</Th>
                  <Th className="w-1/3">Distribution</Th>
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.label} className="border-t border-slate-100">
                    <Td>{b.label}</Td>
                    <Td className="text-right font-semibold">{b.count}</Td>
                    <Td className="text-right">{b.percent}%</Td>
                    <Td>
                      <span
                        className="inline-block h-2 rounded-full bg-amber-600 align-middle"
                        style={{ width: `${b.percent}%` }}
                      />
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <Td>Total graded</Td>
                  <Td className="text-right">{d.total}</Td>
                  <Td className="text-right">{d.total ? '100%' : '—'}</Td>
                  <Td />
                </tr>
              </tbody>
            </table>
          </section>

          {/* ---- marks sheet ---- */}
          <section>
            <SectionTitle n={4} title="Marks sheet" />
            <table className="w-full text-[11px] border border-slate-200">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <Th className="w-8 text-right">#</Th>
                  <Th>Member</Th>
                  <Th>Reg / ID</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right">%</Th>
                  <Th className="text-center">Grade</Th>
                  <Th className="text-center">Pos</Th>
                  <Th className="text-center">Result</Th>
                  <Th>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {data.members.length === 0 && (
                  <tr>
                    <Td className="text-slate-400 italic" colSpan={9}>
                      No members enrolled in this course.
                    </Td>
                  </tr>
                )}
                {data.members.map((st, i) => {
                  const absent = st.status === 'not_attempted';
                  const pending = st.status === 'in_progress';
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <Td className="text-right text-slate-400">{i + 1}</Td>
                      <Td className="font-semibold">{st.name}</Td>
                      <Td className="font-mono">{st.memberNumber || '—'}</Td>
                      <Td className="text-right">
                        {absent || pending
                          ? '—'
                          : `${st.score ?? '—'} / ${st.maxScore ?? z.totalMarks ?? '—'}`}
                      </Td>
                      <Td className="text-right font-semibold">
                        {st.percentage != null ? `${st.percentage}%` : '—'}
                      </Td>
                      <Td className="text-center">{gradeLetter(st.percentage)}</Td>
                      <Td className="text-center text-slate-500">{st.rank ?? '—'}</Td>
                      <Td className="text-center">
                        {st.passed == null ? (
                          <span className="text-slate-400">{STATUS_LABEL[st.status]}</span>
                        ) : st.passed ? (
                          <span className="font-bold text-emerald-700">Pass</span>
                        ) : (
                          <span className="font-bold text-rose-700">Fail</span>
                        )}
                      </Td>
                      <Td className="text-slate-500">
                        {st.submittedAt ? formatDateTime(st.submittedAt) : '—'}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-500">
              Members are listed alphabetically. Where a member has more than one attempt, the best
              completed attempt is shown; "Pos" ranks graded members by score (ties share a
              position).
            </p>
          </section>

          <p className="text-[10px] text-slate-400 pt-2">
            Grade bands: A ≥ 90, B 75–89, C 60–74, D &lt; 60. Pass / Fail is measured against this
            quiz's pass mark of {z.passingScore}%. Averages exclude absent members and attempts still
            in progress.
          </p>

          {/* ---- signature ---- */}
          <div className="grid grid-cols-2 gap-10 pt-8 text-[11px] text-slate-600">
            <div>
              <div className="border-t border-slate-400 pt-1">Leader's signature &amp; date</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">HoD / Examinations officer</div>
            </div>
          </div>
        </div>

        {/* ---- footer ---- */}
        <footer className="report-footer mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
          <span>{data.institution.name} · {data.institution.system}</span>
          <span>Confidential — for internal academic use only</span>
          <span>Generated {formatDate(data.generatedAt)}</span>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="text-[13px] font-extrabold text-slate-900 mb-2 flex items-center gap-2">
      <span className="w-5 h-5 rounded bg-slate-900 text-white text-[10px] flex items-center justify-center">
        {n}
      </span>
      {title}
    </h2>
  );
}

function Fig({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-2 py-1.5 font-semibold text-slate-400 w-40 align-top">{label}</td>
      <td className="px-2 py-1.5">{children}</td>
    </tr>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-bold px-2 py-1.5 ${className}`}>{children}</th>;
}
function Td({
  children,
  className = '',
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-2 py-1.5 align-top ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
