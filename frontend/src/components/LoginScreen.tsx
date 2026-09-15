import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { Spinner } from '@/components/ui/States';
import type { UserRole } from '@/types';

type Mode = 'login' | 'register';
type Step = 'identify' | 'code';

export function LoginScreen() {
  const { register, requestOtp, verifyOtp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: {
      from?: { pathname?: string };
      redirect?: string;
    };
  };

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('identify');
  const [role, setRole] = useState<UserRole>('member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // Login accepts a member registration number, a staff ID, or an email.
  const [identifier, setIdentifier] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const err = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let dest: string;
      if (mode === 'register') {
        const res = await register({ name: name.trim(), email: email.trim(), role });
        setDevCode(res.devCode);
        dest = email.trim();
      } else {
        const res = await requestOtp(identifier.trim());
        setDevCode(res.devCode);
        dest = res.sentTo || identifier.trim();
      }
      setSentTo(dest);
      setStep('code');
      toast.success(`We sent a 6-digit code to ${dest}`);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      err(e, 'Could not send a verification code');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const who = mode === 'register' ? email.trim() : identifier.trim();
      const redirect = location.state?.redirect;
      const { user } = await verifyOtp(who, code.trim());
      const dest =
        redirect ||
        location.state?.from?.pathname ||
        (user.role === 'member' ? '/member' : '/leader');
      navigate(dest, { replace: true });
    } catch (e) {
      err(e, 'That code did not work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2 border border-slate-200/20">
        {/* form */}
        <div className="p-8 lg:p-12 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Gisozi Youth Mass Choir <span className="text-blue-600">Quiz</span>
              </span>
            </div>

            {step === 'identify' ? (
              <>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {mode === 'login' ? 'Sign in' : 'Create your account'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  We use a one-time code sent to your email — no password to remember.
                </p>

                {mode === 'register' && (
                  <div className="mt-6 flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                    {(['member', 'leader'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          role === r ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {r === 'member' ? 'person' : 'psychology'}
                        </span>
                        <span>{r === 'member' ? 'Member' : 'Choir Leader'}</span>
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={sendCode} className="mt-5 space-y-4 text-xs">
                  {mode === 'register' && (
                    <div>
                      <label htmlFor="auth-name" className="font-semibold text-slate-700 block mb-1">
                        Full name
                      </label>
                      <input
                        id="auth-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={2}
                        className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                  {mode === 'register' ? (
                    <div>
                      <label htmlFor="auth-email" className="font-semibold text-slate-700 block mb-1">
                        Email address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="auth-identifier" className="font-semibold text-slate-700 block mb-1">
                        Member number or email
                      </label>
                      <input
                        id="auth-identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        minLength={3}
                        autoComplete="username"
                        placeholder="e.g. GYMC/001"
                        className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Members: your choir member number. Leaders: your email. We email your
                        code to the address on file.
                      </p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    {busy && <Spinner />}
                    {mode === 'login' ? 'Send sign-in code' : 'Create account & send code'}
                  </button>
                </form>

                <p className="mt-4 text-[11px] text-slate-500">
                  {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
                  <button
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    {mode === 'login' ? 'Register' : 'Sign in'}
                  </button>
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Enter your code</h1>
                <p className="text-xs text-slate-500 mt-1">
                  We sent a 6-digit code to <strong>{sentTo}</strong>. It expires in 10 minutes.
                </p>

                {devCode && (
                  <div className="mt-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    Dev mode — your code is <strong className="font-mono">{devCode}</strong>
                  </div>
                )}

                <form onSubmit={verify} className="mt-5 space-y-4 text-xs">
                  <input
                    ref={codeRef}
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    {busy && <Spinner />}
                    Verify & continue
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <button
                    onClick={() => {
                      setStep('identify');
                      setCode('');
                    }}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    ← Use a different account
                  </button>
                  <button onClick={sendCode} className="text-blue-600 font-semibold hover:underline">
                    Resend code
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* hero */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 text-white relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              AI-Powered Choir Study Companion
            </span>
            <h2 className="text-2xl font-black leading-tight text-white">
              Grounded question generation &amp; instant, personal feedback
            </h2>
            <p className="text-xs text-blue-200/90 leading-relaxed">
              Every quiz question and every piece of feedback is linked directly to your leader's
              course material — turning assessments into personalized learning journeys.
            </p>
          </div>
          <div className="relative z-10 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <span className="material-symbols-outlined text-emerald-400">verified</span>
              <span>AI short-answer grading with material references</span>
            </div>
            <p className="text-[11px] text-blue-100/80">
              Instant scores, explanations, and the exact slide or page to revise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
