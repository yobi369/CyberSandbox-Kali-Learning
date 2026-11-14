import { ArrowRight, BookOpen, Mail, ShieldCheck, TerminalSquare } from 'lucide-react';

type PublicDemoLandingProps = {
  onStart: () => void;
  onInstitutionSignIn: () => void;
};

const contactHref = 'mailto:bmutunga794@gmail.com?subject=CyberSandbox%20demo%20inquiry';

export default function PublicDemoLanding({ onStart, onInstitutionSignIn }: PublicDemoLandingProps) {
  return (
    <main className="min-h-screen bg-[#050b17] text-slate-200">
      <header className="border-b border-slate-800 bg-[#080f1e]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <a href="#main" className="flex items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            <ShieldCheck className="text-cyan-400" size={30} aria-hidden="true" />
            <span className="text-xl font-black text-white">CYBER<span className="text-cyan-400">SANDBOX</span></span>
          </a>
          <button type="button" onClick={onInstitutionSignIn} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            Institution sign in
          </button>
        </div>
      </header>

      <div id="main" className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <section aria-labelledby="demo-title" className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              Browser-based simulator
            </p>
            <h1 id="demo-title" className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
              Learn cybersecurity by investigating fictional scenarios.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Explore guided exercises, inspect seeded evidence, and practice explaining your findings in a safe simulated environment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                Open simulated labs <ArrowRight size={18} aria-hidden="true" />
              </button>
              <a href={contactHref} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-200 hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">
                <Mail size={17} aria-hidden="true" /> Contact the project
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">No account is needed to try the simulator. Your practice progress stays in this browser.</p>
          </div>

          <aside className="rounded-3xl border border-cyan-500/20 bg-slate-900/70 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white">What you can try</h2>
            <ul className="mt-5 space-y-5">
              <li className="flex gap-4">
                <BookOpen className="mt-1 shrink-0 text-cyan-300" size={20} aria-hidden="true" />
                <div><h3 className="font-semibold text-slate-100">Guided learning</h3><p className="mt-1 text-sm leading-6 text-slate-400">Work through structured lessons and fictional cybersecurity scenarios.</p></div>
              </li>
              <li className="flex gap-4">
                <TerminalSquare className="mt-1 shrink-0 text-cyan-300" size={20} aria-hidden="true" />
                <div><h3 className="font-semibold text-slate-100">Simulated terminal</h3><p className="mt-1 text-sm leading-6 text-slate-400">Practice a small set of commands against seeded sample outputs; nothing runs on your device.</p></div>
              </li>
              <li className="flex gap-4">
                <ShieldCheck className="mt-1 shrink-0 text-cyan-300" size={20} aria-hidden="true" />
                <div><h3 className="font-semibold text-slate-100">Formative feedback</h3><p className="mt-1 text-sm leading-6 text-slate-400">Review rubric-based feedback for practice, not formal grades or certification.</p></div>
              </li>
            </ul>
          </aside>
        </section>

        <section aria-labelledby="safety-title" className="mt-14 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 sm:mt-20 sm:p-6">
          <h2 id="safety-title" className="font-bold text-amber-200">Demo boundaries</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This is a simulator only: targets and evidence are fictional, commands are not executed, and no network traffic is sent. Progress is local and is not verified or synced to an instructor. Live Kali labs are not available.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Contact opens your email application; this site does not submit or store an inquiry form.
          </p>
        </section>
      </div>

      <footer className="border-t border-slate-800 px-5 py-5 text-center text-xs text-slate-500">
        CyberSandbox · Simulated cybersecurity learning
      </footer>
    </main>
  );
}
