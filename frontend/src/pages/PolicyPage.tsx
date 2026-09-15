import { Link } from 'react-router-dom';
import { Footer } from '@/components/Footer';

function Shell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-base">school</span>
            </div>
            <span className="font-extrabold text-sm tracking-tight">
              GYMC <span className="text-amber-600">Quiz</span>
            </span>
          </Link>
          <Link to="/login" className="text-xs font-bold text-amber-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto px-4 md:px-8 py-12 text-sm text-slate-700 leading-relaxed space-y-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-400 mt-1">Last updated {updated}</p>
        </div>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="text-xs md:text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of Service" updated="15 September 2026">
      <Section title="1. Who this is for">
        <p>
          Gisozi Youth Mass Choir Quiz ("GYMC Quiz") is a study and assessment tool for members and
          leaders of the Gisozi Youth Mass Choir. By creating an account you agree to use it for that
          purpose in good faith.
        </p>
      </Section>
      <Section title="2. Accounts">
        <p>
          Member accounts are self-registered with a name, phone number, email and password. Leader
          and administrator accounts are created by an administrator. You're responsible for keeping
          your password confidential and for activity under your account.
        </p>
      </Section>
      <Section title="3. Course material and quizzes">
        <p>
          Leaders upload study material and build quizzes for their courses. Members take quizzes and
          receive AI-assisted grading and feedback grounded in that material. Leaders remain
          responsible for the accuracy of material and questions they publish.
        </p>
      </Section>
      <Section title="4. Acceptable use">
        <p>
          Don't attempt to manipulate AI grading (for example, by instructing the grader to ignore its
          rules inside an answer), share your login with others, or upload material you don't have the
          right to use.
        </p>
      </Section>
      <Section title="5. Changes">
        <p>These terms may be updated from time to time as the app evolves; continued use means you accept the current version.</p>
      </Section>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy Policy" updated="15 September 2026">
      <Section title="What we collect">
        <p>
          Name, email, phone number, and a securely hashed password at registration. Course activity —
          quiz attempts, answers, and scores — is stored to power results, feedback and analytics.
        </p>
      </Section>
      <Section title="How it's used">
        <p>
          Your data is used to run the app: authenticating you, showing your courses and quizzes,
          grading answers (including sending short-answer text to an AI grading provider), and
          producing progress analytics for you and your leader.
        </p>
      </Section>
      <Section title="Who can see it">
        <p>
          Leaders can see the results and progress of members enrolled in their own courses.
          Administrators can see leader and admin account details. Members only ever see their own
          results.
        </p>
      </Section>
      <Section title="Storage & security">
        <p>
          Passwords are hashed, never stored in plain text. Uploaded material and quiz data are stored
          on the app's servers and are not sold or shared with third parties beyond what's needed to
          run the AI grading and question-generation features.
        </p>
      </Section>
      <Section title="Your choices">
        <p>Contact your choir administrator if you'd like your account or data removed.</p>
      </Section>
    </Shell>
  );
}
