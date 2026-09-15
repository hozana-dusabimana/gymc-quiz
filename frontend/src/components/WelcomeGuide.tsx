import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

interface GuideStep {
  icon: string;
  title: string;
  body: string;
  points: string[];
  cta?: { label: string; to: string };
  /** `data-tour` value of the element to highlight for this step. */
  anchor?: string;
}

// Every anchor below is visible on the dashboard (sidebar nav, top bar, stat
// cards), so the tour never changes route or scrolls the page around while it
// runs — it just moves the highlight straight from one element to the next.
const STEPS: Record<UserRole, GuideStep[]> = {
  member: [
    {
      icon: 'waving_hand',
      title: 'Welcome to Gisozi Youth Mass Choir Quiz',
      body: 'A quick one-minute tour of where everything lives. You can reopen it any time from the "Guide" button up here.',
      points: [
        'Everything you need is in the left sidebar.',
        'Use the buttons below to move through the tour.',
      ],
      anchor: 'guide-button',
    },
    {
      icon: 'menu_book',
      title: '1 · Your courses',
      body: 'Open "My Courses" to read or download the leader\'s materials before an assessment.',
      points: [
        'Each course holds its own notes, slides and PDFs.',
        'Not seeing a course? Ask your leader to confirm your enrolment.',
      ],
      anchor: 'nav-/member/courses',
      cta: { label: 'Open My Courses', to: '/member/courses' },
    },
    {
      icon: 'quiz',
      title: '2 · Take an assessment',
      body: 'Published quizzes appear under "Quizzes" and as "Available now" on your dashboard.',
      points: [
        'Check the duration, question count and deadline before you start.',
        'The timer starts when you press Start — finish in one sitting.',
      ],
      anchor: 'nav-/member/quizzes',
      cta: { label: 'Open Quizzes', to: '/member/quizzes' },
    },
    {
      icon: 'auto_awesome',
      title: '3 · Read your AI feedback',
      body: 'After you submit, the AI grades your written answers and explains every result under "Results & Insights".',
      points: [
        'Each answer shows what was expected and where it came from in the material.',
        '"Review feedback" on the dashboard jumps straight to a result.',
      ],
      anchor: 'nav-/member/results',
      cta: { label: 'Open Results & Insights', to: '/member/results' },
    },
    {
      icon: 'trending_up',
      title: '4 · Track your progress',
      body: 'These cards show your average score and how many quizzes you have taken. They update as soon as grading finishes.',
      points: ['Stuck on anything? Contact your choir leader.'],
      anchor: 'stat-cards',
    },
  ],
  leader: [
    {
      icon: 'waving_hand',
      title: 'Welcome to the choir leader workspace',
      body: 'A quick tour of the tools, in order — from setting up a course to reviewing AI-graded results. Reopen it any time from "Guide".',
      points: [
        'All tools are in the left sidebar.',
        'Use the buttons below to move through the tour.',
      ],
      anchor: 'guide-button',
    },
    {
      icon: 'school',
      title: '1 · Set up a course',
      body: 'Create a course, then enrol your choir members so they can see its quizzes.',
      points: [
        '"New course" creates a course you own.',
        'Members must be enrolled in a course before they can see its quizzes.',
      ],
      anchor: 'nav-/leader/courses',
      cta: { label: 'Open Courses', to: '/leader/courses' },
    },
    {
      icon: 'upload_file',
      title: '2 · Upload course materials',
      body: 'Add lecture notes, slides or PDFs to the Material Library. The AI reads and indexes each file.',
      points: [
        'Wait for a material to reach "Ready" before generating questions from it.',
        'Better materials produce sharper questions and feedback.',
      ],
      anchor: 'nav-/leader/materials',
      cta: { label: 'Open Material Library', to: '/leader/materials' },
    },
    {
      icon: 'help_outline',
      title: '3 · Build a question bank',
      body: 'Generate questions from your materials with AI, then edit, tag and approve the ones you want to keep.',
      points: [
        'Each question links back to the page in the material it came from.',
        'Approved questions are reusable across many quizzes.',
      ],
      anchor: 'nav-/leader/questions',
      cta: { label: 'Open Question Bank', to: '/leader/questions' },
    },
    {
      icon: 'edit_note',
      title: '4 · Create and publish a quiz',
      body: 'In Quiz Studio pick questions, set the duration, attempts and deadline, then publish.',
      points: [
        'A quiz stays a draft until you publish it — members see nothing before then.',
        'Set an opening date to schedule a quiz in advance.',
      ],
      anchor: 'nav-/leader/quizzes/new',
      cta: { label: 'Open Quiz Studio', to: '/leader/quizzes/new' },
    },
    {
      icon: 'query_stats',
      title: '5 · Review analytics and grading',
      body: 'Once submissions arrive, Analytics shows average scores, per-question difficulty and every AI-graded answer.',
      points: [
        'You can override any AI grade before releasing results.',
        'Per-quiz analytics are one click from each quiz card on the dashboard.',
      ],
      anchor: 'nav-/leader/analytics',
      cta: { label: 'Open Analytics & Grades', to: '/leader/analytics' },
    },
  ],
  admin: [
    {
      icon: 'waving_hand',
      title: 'Welcome, administrator',
      body: 'Your job is simple: create the accounts choir leaders (and other admins) sign in with.',
      points: [
        'Members still register themselves — you only create leader and admin accounts.',
        'Reopen this guide any time from "Guide".',
      ],
      anchor: 'guide-button',
    },
    {
      icon: 'person_add',
      title: '1 · Create a leader',
      body: 'Fill in their name, phone, email and a temporary password, then share the password with them securely.',
      points: ['They sign in immediately with the credentials you set.'],
      anchor: 'nav-/admin',
      cta: { label: 'Open Leaders & Admins', to: '/admin' },
    },
  ],
};

const SEEN_PREFIX = 'gymc.welcomeGuide.seen.';

function hasSeen(userId: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

function markSeen(userId: string) {
  try {
    localStorage.setItem(SEEN_PREFIX + userId, '1');
  } catch {
    /* storage unavailable — guide just shows again next session */
  }
}

interface GuideContextValue {
  openGuide: () => void;
}

const GuideContext = createContext<GuideContextValue | null>(null);

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

type AnchorState = 'resolving' | 'anchored' | 'fallback';

/**
 * On-screen box of the element carrying `data-tour="<anchor>"`, plus a state:
 *   resolving — still locating the element (show a plain dim, never a card)
 *   anchored  — found: highlight + popover sit on the element
 *   fallback  — no anchor / narrow screen / not found in time: centred card
 *
 * The element is resolved once (short rAF retry while it mounts), scrolled into
 * view only if it is actually off-screen and only instantly, then measured once
 * and kept in sync with scroll + resize. Crucially the card is NEVER rendered
 * in the centre while resolving, so it doesn't flash to the middle and then
 * travel out to the target.
 */
function useAnchor(
  anchor: string | undefined,
  open: boolean,
  step: number,
): { rect: Rect | null; state: AnchorState } {
  const [rect, setRect] = useState<Rect | null>(null);
  const [state, setState] = useState<AnchorState>('resolving');

  useEffect(() => {
    setRect(null);
    if (!open) {
      setState('resolving');
      return;
    }
    // Narrow screens collapse the sidebar / actions — go straight to a centred card.
    if (!anchor || window.innerWidth < 768) {
      setState('fallback');
      return;
    }
    setState('resolving');

    let raf = 0;
    let cancelled = false;
    let el: HTMLElement | null = null;
    const started = Date.now();

    const measure = () => {
      if (!el || cancelled) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      setRect((prev) =>
        prev &&
        Math.abs(prev.top - r.top) < 1 &&
        Math.abs(prev.left - r.left) < 1 &&
        Math.abs(prev.width - r.width) < 1 &&
        Math.abs(prev.height - r.height) < 1
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
    };

    const attach = (node: HTMLElement) => {
      el = node;
      const r = node.getBoundingClientRect();
      const margin = 80;
      if (r.top < margin || r.bottom > window.innerHeight - margin) {
        node.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      measure();
      setState('anchored');
      window.addEventListener('scroll', measure, true);
      window.addEventListener('resize', measure);
    };

    const find = () => {
      if (cancelled) return;
      const found = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
      if (found && found.getBoundingClientRect().width > 0) {
        attach(found);
        return;
      }
      if (Date.now() - started < 1200) raf = requestAnimationFrame(find);
      else setState('fallback');
    };
    find();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [anchor, open, step]);

  return { rect, state };
}

interface PopPos {
  top: number;
  left: number;
  arrow: 'top' | 'bottom' | 'left' | 'right' | 'none';
  arrowAt: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/** Where to put the popover relative to the highlighted rect. */
function placePopover(rect: Rect, pop: { w: number; h: number }): PopPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 14;
  const M = 12;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const clampLeft = (l: number) => clamp(l, M, vw - pop.w - M);
  const clampTop = (t: number) => clamp(t, M, vh - pop.h - M);

  if (rect.left + rect.width + gap + pop.w <= vw - M)
    return { top: clampTop(cy - pop.h / 2), left: rect.left + rect.width + gap, arrow: 'left', arrowAt: cy };
  if (rect.top + rect.height + gap + pop.h <= vh - M)
    return { top: rect.top + rect.height + gap, left: clampLeft(cx - pop.w / 2), arrow: 'top', arrowAt: cx };
  if (rect.top - gap - pop.h >= M)
    return { top: rect.top - gap - pop.h, left: clampLeft(cx - pop.w / 2), arrow: 'bottom', arrowAt: cx };
  if (rect.left - gap - pop.w >= M)
    return { top: clampTop(cy - pop.h / 2), left: rect.left - gap - pop.w, arrow: 'right', arrowAt: cy };
  return { top: vh / 2 - pop.h / 2, left: vw / 2 - pop.w / 2, arrow: 'none', arrowAt: 0 };
}

function arrowStyle(pos: PopPos): CSSProperties {
  const off = (base: number) => clamp(base, 14, 9999);
  if (pos.arrow === 'top')
    return { top: -5, left: off(pos.arrowAt - pos.left - 5), borderWidth: '1px 0 0 1px' };
  if (pos.arrow === 'bottom')
    return { bottom: -5, left: off(pos.arrowAt - pos.left - 5), borderWidth: '0 1px 1px 0' };
  if (pos.arrow === 'left')
    return { left: -5, top: off(pos.arrowAt - pos.top - 5), borderWidth: '0 0 1px 1px' };
  return { right: -5, top: off(pos.arrowAt - pos.top - 5), borderWidth: '1px 1px 0 0' };
}

export function WelcomeGuideProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const steps = user ? STEPS[user.role] : [];
  const current = steps[step];

  // Auto-open on first login for this user.
  useEffect(() => {
    if (user && !hasSeen(user.id)) {
      setStep(0);
      setOpen(true);
    }
  }, [user]);

  const openGuide = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (user) markSeen(user.id);
  }, [user]);

  const goTo = useCallback(
    (to: string) => {
      close();
      navigate(to);
    },
    [close, navigate],
  );

  const value = useMemo(() => ({ openGuide }), [openGuide]);

  const { rect, state } = useAnchor(current?.anchor, open, step);
  const isLast = step === steps.length - 1;

  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopPos | null>(null);

  // Position the popover synchronously before paint so it appears in place —
  // no CSS transition, so it never slides or bounces between steps.
  useLayoutEffect(() => {
    if (!open || !rect || !popRef.current) {
      setPos(null);
      return;
    }
    const el = popRef.current;
    setPos(placePopover(rect, { w: el.offsetWidth, h: el.offsetHeight }));
  }, [open, rect, step]);

  const card = current && (
    <div
      ref={popRef}
      className="bg-white rounded-2xl w-[min(92vw,22rem)] shadow-2xl border border-slate-200 flex flex-col"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Getting started guide"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Getting started · {step + 1} of {steps.length}
        </span>
        <button
          onClick={close}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Close guide"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <div className="px-5 pt-2">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl">{current.icon}</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{current.title}</h3>
          <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">{current.body}</p>
        </div>
        <ul className="space-y-1.5">
          {current.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
              <span className="material-symbols-outlined text-base text-emerald-600 shrink-0">check_circle</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {current.cta && (
          <button
            onClick={() => goTo(current.cta!.to)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            {current.cta.label}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100">
        <button onClick={close} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
          {isLast ? 'Close' : 'Skip tour'}
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
          >
            {isLast ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <GuideContext.Provider value={value}>
      {children}

      {open && current && (
        <div className="fixed inset-0 z-[60]" role="presentation">
          {state === 'anchored' && rect ? (
            <>
              {/* dimmer with a hole punched over the target (no transition — no bounce) */}
              <div
                className="fixed rounded-xl pointer-events-none"
                style={{
                  top: rect.top - PAD,
                  left: rect.left - PAD,
                  width: rect.width + PAD * 2,
                  height: rect.height + PAD * 2,
                  boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)',
                  outline: '2px solid rgb(129 140 248)',
                  outlineOffset: '2px',
                }}
              />
              {/* click-catcher (closes on outside click) */}
              <div className="fixed inset-0" onClick={close} />
              {/* anchored popover — placed before paint, so no travel from centre */}
              <div
                className="fixed"
                style={
                  pos
                    ? { top: pos.top, left: pos.left }
                    : { top: 0, left: 0, opacity: 0, pointerEvents: 'none' }
                }
              >
                {pos && pos.arrow !== 'none' && (
                  <span
                    className="absolute w-2.5 h-2.5 bg-white border-slate-200 rotate-45"
                    style={arrowStyle(pos)}
                  />
                )}
                {card}
              </div>
            </>
          ) : state === 'fallback' ? (
            /* no anchor / narrow screen / not found in time — centred card */
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4"
              onClick={close}
            >
              {card}
            </div>
          ) : (
            /* resolving — plain dim only, same shade as the spotlight, no card.
               The hole simply appears once the element is located. */
            <div className="fixed inset-0" style={{ background: 'rgba(15,23,42,0.55)' }} onClick={close} />
          )}
        </div>
      )}
    </GuideContext.Provider>
  );
}

export function useWelcomeGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useWelcomeGuide must be used within <WelcomeGuideProvider>');
  return ctx;
}
