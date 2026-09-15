import { Link } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import heroGroup from '@/assets/choir/hero-group.jpg';
import heroQuartet from '@/assets/choir/hero-quartet.jpg';
import performing from '@/assets/choir/performing.jpg';
import soloSinger from '@/assets/choir/solo-singer.jpg';
import duet from '@/assets/choir/duet.jpg';
import portrait from '@/assets/choir/portrait.jpg';
import trio from '@/assets/choir/trio.jpg';
import photographer from '@/assets/choir/photographer.jpg';

const FEATURES = [
  {
    icon: 'auto_awesome',
    title: 'AI-generated questions',
    body: 'Leaders upload notes or slides — the AI reads them and drafts multiple-choice, true/false and short-answer questions in seconds.',
  },
  {
    icon: 'fact_check',
    title: 'Grounded, explainable grading',
    body: 'Short answers are graded against the leader\'s own material, with the exact page cited behind every explanation — no black-box scores.',
  },
  {
    icon: 'bolt',
    title: 'Instant, personal feedback',
    body: 'Members see their score, a corrected model answer, and the source reference the moment they submit — not days later.',
  },
  {
    icon: 'insights',
    title: 'Real progress, not just grades',
    body: 'Streaks, performance trends and course-by-course averages help every member see where they\'re improving.',
  },
];

const STEPS_LEADER = [
  { icon: 'school', title: 'Create a course', body: 'Set up a course for your choir topic — theory, hymns, liturgy, anything.' },
  { icon: 'upload_file', title: 'Upload material', body: 'Add PDFs, slides or notes. The AI indexes them automatically.' },
  { icon: 'edit_note', title: 'Build a quiz', body: 'Generate questions with AI or write your own, then publish on your schedule.' },
  { icon: 'query_stats', title: 'Review results', body: 'See every member\'s score, AI evaluation, and course-wide analytics.' },
];

const STEPS_MEMBER = [
  { icon: 'menu_book', title: 'Open your course', body: 'Read the material your leader shared before an assessment.' },
  { icon: 'quiz', title: 'Take the quiz', body: 'A clear timer, autosave, and a calm, focused screen.' },
  { icon: 'auto_awesome', title: 'Get AI feedback', body: 'Instant scores with an explanation and the exact source cited.' },
  { icon: 'trending_up', title: 'Track your growth', body: 'Watch your streak and average score improve quiz after quiz.' },
];

const GALLERY = [heroQuartet, performing, soloSinger, duet, trio, portrait, photographer];

export function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <span className="material-symbols-outlined text-xl">school</span>
            </div>
            <span className="font-extrabold text-base tracking-tight">
              GYMC <span className="text-blue-600">Quiz</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          <img src={heroGroup} alt="Gisozi Youth Mass Choir" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              AI-powered choir quizzes
            </span>
            <h1 className="text-4xl md:text-5xl font-black leading-tight text-white tracking-tight">
              Study together.
              <br />
              Grow together.
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg">
              Gisozi Youth Mass Choir Quiz turns your leaders' notes and lessons into
              AI-graded assessments — with instant, explainable feedback for every
              choir member.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/login"
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 transition-colors flex items-center gap-2"
              >
                Join the choir
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-sm font-bold backdrop-blur-sm transition-colors"
              >
                I'm a choir leader
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4 text-slate-300 text-xs">
              <div>
                <div className="text-xl font-black text-white">100%</div>
                <div>AI-graded feedback</div>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <div className="text-xl font-black text-white">Instant</div>
                <div>Results &amp; explanations</div>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <div className="text-xl font-black text-white">Free</div>
                <div>For the whole choir</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Why GYMC Quiz</span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">
            Built for how a choir actually studies
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all bg-white"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-2xl">{f.icon}</span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* gallery */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Our choir</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Gisozi Youth Mass Choir</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-2">
              A community of young voices, rehearsing, performing and growing together.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {GALLERY.map((src, i) => (
              <div
                key={i}
                className={`rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${
                  i === 0 ? 'col-span-2 row-span-2' : ''
                }`}
              >
                <img src={src} alt="Gisozi Youth Mass Choir member" className="w-full h-full object-cover aspect-square" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-16">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">psychology</span>
            </span>
            <h3 className="text-lg font-black tracking-tight">For choir leaders</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS_LEADER.map((s, i) => (
              <div key={s.title} className="relative p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <span className="absolute -top-3 -left-1 text-4xl font-black text-indigo-200">{i + 1}</span>
                <span className="material-symbols-outlined text-indigo-600 text-xl mb-2 block">{s.icon}</span>
                <h4 className="font-bold text-sm text-slate-900">{s.title}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">person</span>
            </span>
            <h3 className="text-lg font-black tracking-tight">For choir members</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS_MEMBER.map((s, i) => (
              <div key={s.title} className="relative p-5 rounded-2xl bg-blue-50/60 border border-blue-100">
                <span className="absolute -top-3 -left-1 text-4xl font-black text-blue-200">{i + 1}</span>
                <span className="material-symbols-outlined text-blue-600 text-xl mb-2 block">{s.icon}</span>
                <h4 className="font-bold text-sm text-slate-900">{s.title}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-950 px-8 py-14 md:py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Ready to join?</h2>
          <p className="text-sm text-blue-100/90 mt-2 max-w-md mx-auto">
            Create your free account in under a minute — no OTP, no hassle.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-shadow"
          >
            Get started
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
