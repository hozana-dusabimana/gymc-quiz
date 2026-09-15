import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@/hooks/useApi';
import { Analytics } from '@/lib/services';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { formatDate, formatDateTime, pct } from '@/lib/format';

export function AnalyticsReportPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(() => Analytics.report(), []);

  useEffect(() => {
    document.title = 'GYMC Quiz — Assessment Performance Report';
    return () => {
      document.title = 'Gisozi Youth Mass Choir Quiz';
    };
  }, []);

  if (loading) return <LoadingState label="Compiling report…" className="min-h-screen" />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} className="min-h-screen" />;

  const { summary: s, distribution: d } = data;
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
          onClick={() => navigate('/leader/analytics')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-600"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back to analytics
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
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">print</span> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="mx-auto my-6 print:my-0 bg-white shadow-xl report-sheet w-[210mm] max-w-full p-[16mm] print:p-0">
        {/* ---- header ---- */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-700 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
              U
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                {data.institution.name}
              </h1>
              <p className="text-xs text-slate-500 font-semibold">{data.institution.system}</p>
              <p className="mt-2 text-sm font-bold text-indigo-700 uppercase tracking-wide">
                Assessment Performance Report
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
              <tr>
                <td className="pr-3 font-semibold text-slate-400 align-top">Scope</td>
                <td>All courses &amp; assessments</td>
              </tr>
              {data.departments.length > 0 && (
                <tr>
                  <td className="pr-3 font-semibold text-slate-400 align-top">Department</td>
                  <td>{data.departments.join(', ')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </header>

        <div className="report-body space-y-6 pt-6 text-slate-800">
          {/* ---- executive summary ---- */}
          <section>
            <SectionTitle n={1} title="Executive summary" />
            <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              <Fig label="Courses" value={s.courses} />
              <Fig label="Assessments" value={s.assessments} />
              <Fig label="Members assessed" value={s.members} />
              <Fig label="Graded submissions" value={s.submissions} />
              <Fig label="Overall average" value={s.averageScore != null ? `${s.averageScore}%` : '—'} />
              <Fig label="Pass rate" value={s.passRate != null ? `${s.passRate}%` : '—'} />
              <Fig label="Highest score" value={s.highestScore != null ? `${s.highestScore}%` : '—'} />
              <Fig label="Lowest score" value={s.lowestScore != null ? `${s.lowestScore}%` : '—'} />
              <Fig label="Below pass cutoff" value={s.belowCutoff} />
            </div>
            {s.averageMinutes != null && (
              <p className="mt-2 text-[11px] text-slate-500">
                Average time spent per submission: {s.averageMinutes} minutes.
              </p>
            )}
            {s.submissions === 0 && (
              <p className="mt-2 text-xs text-slate-500 italic">
                No graded submissions yet — figures will populate once members complete assessments.
              </p>
            )}
          </section>

          {/* ---- grade distribution ---- */}
          <section>
            <SectionTitle n={2} title="Grade distribution" />
            <table className="w-full text-[11px] border border-slate-200">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <Th>Band</Th>
                  <Th className="text-right w-24">Results</Th>
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
                      <span className="inline-block h-2 rounded-full bg-indigo-600 align-middle" style={{ width: `${b.percent}%` }} />
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <Td>Total</Td>
                  <Td className="text-right">{d.total}</Td>
                  <Td className="text-right">100%</Td>
                  <Td />
                </tr>
              </tbody>
            </table>
          </section>

          {/* ---- course breakdown ---- */}
          <section>
            <SectionTitle n={3} title="Course breakdown" />
            <table className="w-full text-[11px] border border-slate-200">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <Th>Course</Th>
                  <Th className="text-right">Enrolled</Th>
                  <Th className="text-right">Assessments</Th>
                  <Th className="text-right">Submissions</Th>
                  <Th className="text-right">Average</Th>
                  <Th className="text-right">Pass rate</Th>
                </tr>
              </thead>
              <tbody>
                {data.courses.length === 0 && (
                  <tr>
                    <Td className="text-slate-400 italic" colSpan={6}>
                      No courses.
                    </Td>
                  </tr>
                )}
                {data.courses.map((c) => (
                  <tr key={c.code} className="border-t border-slate-100">
                    <Td>
                      <span className="font-bold font-mono">{c.code}</span> — {c.title}
                    </Td>
                    <Td className="text-right">{c.enrolled}</Td>
                    <Td className="text-right">
                      {c.quizzes}
                      {c.published ? ` (${c.published} live)` : ''}
                    </Td>
                    <Td className="text-right">{c.submissions}</Td>
                    <Td className="text-right font-semibold">{pct(c.averageScore)}</Td>
                    <Td className="text-right">{c.passRate != null ? `${c.passRate}%` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ---- assessment breakdown ---- */}
          <section>
            <SectionTitle n={4} title="Assessment breakdown" />
            <table className="w-full text-[11px] border border-slate-200">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <Th>Assessment</Th>
                  <Th>Course</Th>
                  <Th className="text-right">Qs</Th>
                  <Th className="text-right">Subs</Th>
                  <Th className="text-right">Avg</Th>
                  <Th className="text-right">High</Th>
                  <Th className="text-right">Low</Th>
                  <Th className="text-right">Pass</Th>
                </tr>
              </thead>
              <tbody>
                {data.assessments.length === 0 && (
                  <tr>
                    <Td className="text-slate-400 italic" colSpan={8}>
                      No assessments created.
                    </Td>
                  </tr>
                )}
                {data.assessments.map((q, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <Td>
                      {q.title}
                      <span className="text-slate-400"> · {q.status}</span>
                    </Td>
                    <Td className="font-mono">{q.courseCode}</Td>
                    <Td className="text-right">{q.questionCount}</Td>
                    <Td className="text-right">{q.submissions}</Td>
                    <Td className="text-right font-semibold">{pct(q.averageScore)}</Td>
                    <Td className="text-right">{pct(q.highest)}</Td>
                    <Td className="text-right">{pct(q.lowest)}</Td>
                    <Td className="text-right">{q.passRate != null ? `${q.passRate}%` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ---- every member's average ---- */}
          {data.memberAverages.length > 0 && (
            <section>
              <SectionTitle n={5} title="All members — average across your courses" />
              <table className="w-full text-[11px] border border-slate-200">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <Th className="w-10 text-center">Pos</Th>
                    <Th>Member</Th>
                    <Th>Reg / ID</Th>
                    <Th className="text-right">Assessments</Th>
                    <Th className="text-right">Average</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.memberAverages.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <Td className="text-center">{p.rank ?? i + 1}</Td>
                      <Td className="font-semibold">{p.name}</Td>
                      <Td className="font-mono">{p.memberNumber || '—'}</Td>
                      <Td className="text-right">{p.attempts}</Td>
                      <Td className="text-right font-semibold">{pct(p.averageScore)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <p className="text-[10px] text-slate-400 pt-2">
            Averages are computed from completed submissions only. Grade bands: A ≥ 90, B 75–89, C 60–74, D &lt; 60.
            Pass rate is measured against each assessment's own pass mark.
          </p>
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
      <span className="w-5 h-5 rounded bg-slate-900 text-white text-[10px] flex items-center justify-center">{n}</span>
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
