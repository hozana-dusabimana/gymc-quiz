import { Link } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import { HeroCarousel } from '@/components/HeroCarousel';
import { useReveal } from '@/hooks/useReveal';
import heroGroup from '@/assets/choir/hero-group.jpg';
import heroQuartet from '@/assets/choir/hero-quartet.jpg';
import performing from '@/assets/choir/performing.jpg';
import soloSinger from '@/assets/choir/solo-singer.jpg';
import duet from '@/assets/choir/duet.jpg';
import portrait from '@/assets/choir/portrait.jpg';
import trio from '@/assets/choir/trio.jpg';
import photographer from '@/assets/choir/photographer.jpg';

const HERO_IMAGES = [heroGroup, performing, trio, heroQuartet];

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

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

export function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-md shadow-amber-500/30">
              <span className="material-symbols-outlined text-xl">school</span>
            </div>
            <span className="font-extrabold text-base tracking-tight">
              GYMC <span className="text-amber-600">Quiz</span>
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
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/25 transition-all hover:scale-[1.03]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <HeroCarousel images={HERO_IMAGES} />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6 animate-[fadeInUp_0.7s_ease-out]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 text-xs font-bold border border-amber-400/30">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              AI-powered choir quizzes
            </span>
            <h1 className="text-4xl md:text-5xl font-black leading-tight text-white tracking-tight">
              Study together.
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                Grow together.
              </span>
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg">
              Gisozi Youth Mass Choir Quiz turns your leaders' notes and lessons into
              AI-graded assessments — with instant, explainable feedback for every
              choir member.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/login"
                className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.03] flex items-center gap-2"
              >
                Join the choir
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-sm font-bold backdrop-blur-sm transition-colors"
              >
                Leader sign in
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4 text-slate-300 text-xs">
              <div>
                <div className="text-xl font-black text-amber-300">100%</div>
                <div>AI-graded feedback</div>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <div className="text-xl font-black text-amber-300">Instant</div>
                <div>Results &amp; explanations</div>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <div className="text-xl font-black text-amber-300">Free</div>
                <div>For the whole choir</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Why GYMC Quiz</span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">
            Built for how a choir actually studies
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} className={`delay-${i}`}>
              <div
                style={{ transitionDelay: `${i * 90}ms` }}
                className="h-full p-6 rounded-2xl border border-slate-200 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-100 hover:-translate-y-1 transition-all bg-white"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* gallery */}
      <section className="bg-gradient-to-b from-slate-50 to-amber-50/40 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Our choir</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Gisozi Youth Mass Choir</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-2">
              A community of young voices, rehearsing, performing and growing together.
            </p>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {GALLERY.map((src, i) => (
              <Reveal key={i} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
                <div
                  style={{ transitionDelay: `${i * 70}ms` }}
                  className="h-full rounded-2xl overflow-hidden border border-amber-100 shadow-sm hover:shadow-xl hover:shadow-amber-100 transition-all group"
                >
                  <img
                    src={src}
                    alt="Gisozi Youth Mass Choir member"
                    className="w-full h-full object-cover object-top aspect-square group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-16">
        <div>
          <Reveal className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">psychology</span>
            </span>
            <h3 className="text-lg font-black tracking-tight">For choir leaders</h3>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS_LEADER.map((s, i) => (
              <Reveal key={s.title}>
                <div
                  style={{ transitionDelay: `${i * 90}ms` }}
                  className="relative h-full p-5 rounded-2xl bg-amber-50/70 border border-amber-100 hover:border-amber-300 transition-colors"
                >
                  <span className="absolute -top-3 -left-1 text-4xl font-black text-amber-200">{i + 1}</span>
                  <span className="material-symbols-outlined text-amber-600 text-xl mb-2 block">{s.icon}</span>
                  <h4 className="font-bold text-sm text-slate-900">{s.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <div>
          <Reveal className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">person</span>
            </span>
            <h3 className="text-lg font-black tracking-tight">For choir members</h3>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS_MEMBER.map((s, i) => (
              <Reveal key={s.title}>
                <div
                  style={{ transitionDelay: `${i * 90}ms` }}
                  className="relative h-full p-5 rounded-2xl bg-yellow-50/70 border border-yellow-100 hover:border-yellow-300 transition-colors"
                >
                  <span className="absolute -top-3 -left-1 text-4xl font-black text-yellow-200">{i + 1}</span>
                  <span className="material-symbols-outlined text-yellow-700 text-xl mb-2 block">{s.icon}</span>
                  <h4 className="font-bold text-sm text-slate-900">{s.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 via-amber-700 to-slate-950 px-8 py-14 md:py-16 text-center">
            <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0, transparent 40%)' }} />
            <h2 className="relative text-2xl md:text-3xl font-black text-white tracking-tight">Ready to join?</h2>
            <p className="relative text-sm text-amber-100/90 mt-2 max-w-md mx-auto">
              Create your free account in under a minute — no OTP, no hassle.
            </p>
            <Link
              to="/login"
              className="relative mt-6 inline-flex items-center gap-2 px-7 py-3.5 bg-white text-amber-700 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
            >
              Get started
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </Link>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
