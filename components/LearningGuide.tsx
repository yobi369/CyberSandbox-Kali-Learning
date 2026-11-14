import React, { useState } from 'react';
import type { LearningLesson, LearningModule } from '../curriculum/learningModules';

interface LearningGuideProps {
  module: LearningModule | undefined;
}

const LearningGuide: React.FC<LearningGuideProps> = ({ module }) => {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(module?.lessons[0]?.id ?? null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  if (!module) {
    return <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">Select one of the core labs to open its structured learning guide.</section>;
  }

  const lesson: LearningLesson = module.lessons.find((item) => item.id === activeLessonId) ?? module.lessons[0];

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-3">
      <h4 className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{title}</h4>
      {children}
    </section>
  );

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-4 sm:p-5 space-y-5 text-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Structured learning path</div>
          <h3 className="mt-1 text-lg font-black text-white">Deep-dive field guide</h3>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">{module.overview}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-300">Seeded simulation · no live execution</span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-200">Instructor review required</span>
        </div>
      </div>

      <Section title="Module learning outcomes">
        <ul className="grid gap-2 md:grid-cols-2">
          {module.learningOutcomes.map((outcome) => <li key={outcome} className="rounded-lg border border-white/5 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">{outcome}</li>)}
        </ul>
      </Section>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {module.learningPath.map((step, index) => (
          <div key={step} className="rounded-xl border border-white/5 bg-slate-900/70 p-3">
            <div className="text-[9px] font-black text-cyan-500">STAGE 0{index + 1}</div>
            <div className="mt-1 text-xs font-semibold text-slate-200">{step}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(210px,0.8fr)_minmax(0,2fr)]">
        <nav aria-label="Lessons" className="space-y-2">
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Lessons · {module.lessons.length}</div>
          {module.lessons.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setActiveLessonId(item.id)} aria-pressed={lesson.id === item.id}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${lesson.id === item.id ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/5 bg-slate-900/50 hover:border-white/20'}`}>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Lesson 0{index + 1} · {item.level}</span>
              <span className="mt-1 block text-xs font-bold text-white">{item.title}</span>
              <span className="mt-1 block text-[10px] text-slate-500">{item.estimatedMinutes} min</span>
            </button>
          ))}
        </nav>

        <article className="min-w-0 space-y-6">
          <header className="border-b border-white/10 pb-4">
            <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <span>{lesson.level}</span><span>·</span><span>{lesson.estimatedMinutes} minutes</span>
            </div>
            <h4 className="mt-2 text-xl font-black text-white">{lesson.title}</h4>
            <div className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prerequisites</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{lesson.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </header>

          <Section title="Core concepts">
            <div className="grid gap-2 md:grid-cols-2">
              {lesson.concepts.map((item) => <div key={item.term} className="rounded-xl border border-white/5 bg-slate-900/60 p-3"><h5 className="text-xs font-bold text-white">{item.term}</h5><p className="mt-2 text-xs leading-6 text-slate-400">{item.explanation}</p></div>)}
            </div>
          </Section>

          <Section title="Command anatomy and safe use">
            {lesson.commandAnatomy.map((item) => <div key={item.syntax} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
              <code className="block overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-emerald-300">{item.syntax}</code>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">{item.parts.map((part) => <li key={part}>{part}</li>)}</ul>
              <p className="mt-3 border-l-2 border-amber-500/50 pl-3 text-xs leading-5 text-amber-200/80">{item.safety}</p>
            </div>)}
          </Section>

          <Section title={`Worked example · ${lesson.workedExample.title}`}>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="bg-slate-900 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Illustrative command / activity</div>
              <pre className="overflow-x-auto bg-black/40 p-3 text-xs leading-6 text-emerald-200">{lesson.workedExample.command}</pre>
              <div className="bg-slate-900 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Seeded sample output</div>
              <pre className="overflow-x-auto bg-black/40 p-3 text-xs leading-6 text-slate-300">{lesson.workedExample.output}</pre>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><h5 className="text-[10px] font-black uppercase text-emerald-300">What the evidence supports</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{lesson.workedExample.interpretation.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><h5 className="text-[10px] font-black uppercase text-rose-300">What it does not establish</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{lesson.workedExample.notEstablished.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </Section>

          <Section title="Observation · inference · hypothesis">
            {lesson.evidencePractice.map((item, index) => <div key={index} className="grid gap-2 md:grid-cols-3">
              <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] font-black uppercase text-cyan-300">Observation</div><p className="mt-1 text-xs leading-5">{item.observation}</p></div>
              <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] font-black uppercase text-emerald-300">Inference</div><p className="mt-1 text-xs leading-5">{item.inference}</p></div>
              <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] font-black uppercase text-amber-300">Hypothesis</div><p className="mt-1 text-xs leading-5">{item.hypothesis}</p></div>
            </div>)}
          </Section>

          <Section title="Common mistakes and troubleshooting">
            <div className="space-y-2">{lesson.commonMistakes.map((item) => <div key={item.mistake} className="rounded-lg border border-white/5 bg-slate-900/60 p-3"><p className="text-xs font-bold text-rose-200">{item.mistake}</p><p className="mt-1 text-xs leading-5 text-slate-400"><span className="font-bold text-emerald-300">Better approach: </span>{item.correction}</p></div>)}</div>
          </Section>

          <Section title="Defensive relevance">
            <ul className="list-disc space-y-2 pl-5 text-xs leading-6 text-slate-300">{lesson.defensiveRelevance.map((item) => <li key={item}>{item}</li>)}</ul>
          </Section>

          <Section title="Guided practice">
            <div className="space-y-2">{lesson.guidedPractice.map((item, index) => <div key={item.task} className="rounded-lg border border-white/5 bg-slate-900/60 p-3"><div className="text-[9px] font-black uppercase text-cyan-300">Checkpoint {index + 1}</div><p className="mt-1 text-xs font-semibold text-white">{item.task}</p><p className="mt-2 text-xs leading-5 text-slate-400"><span className="font-bold text-emerald-300">Success criteria: </span>{item.successCriteria}</p></div>)}</div>
          </Section>

          <Section title="Independent practical challenge">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-xs leading-6 text-slate-200">{lesson.independentChallenge.scenario}</p><div className="mt-3 text-[9px] font-black uppercase tracking-widest text-cyan-300">Required deliverables</div><ul className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">{lesson.independentChallenge.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </Section>

          <Section title="Knowledge check">
            {lesson.knowledgeCheck.map((item, index) => {
              const key = `${lesson.id}:${index}`;
              const revealed = Boolean(revealedAnswers[key]);
              return <div key={key} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <p className="text-xs font-bold text-white">{index + 1}. {item.question}</p>
                <button type="button" className="mt-2 rounded-lg border border-cyan-500/30 px-3 py-1.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/10" onClick={() => setRevealedAnswers((previous) => ({ ...previous, [key]: !previous[key] }))}>{revealed ? 'Hide explanation' : 'Reveal answer and rationale'}</button>
                {revealed && <div className="mt-3 space-y-1 text-xs leading-5"><p className="text-emerald-300"><strong>Answer: </strong>{item.answer}</p><p className="text-slate-400"><strong>Why: </strong>{item.rationale}</p></div>}
              </div>;
            })}
          </Section>

          <Section title="Authoritative further study">
            <ul className="space-y-2">{lesson.references.map((item) => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-cyan-300 underline decoration-cyan-500/30 underline-offset-4 hover:text-cyan-200">{item.label} ↗</a></li>)}</ul>
            <p className="text-[10px] leading-5 text-slate-500">References are external study material. Their inclusion does not imply that the simulator queried or validated any live target.</p>
          </Section>

          <Section title={`Applied capstone · ${module.capstoneProject.title}`}>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">{module.capstoneProject.estimatedHours}-hour project · fictional evidence only</p>
              <p className="mt-2 text-xs leading-6 text-slate-200">{module.capstoneProject.scenario}</p>
            </div>
            <div className="space-y-2">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Case packet · supplied fictional evidence</h5>
              {module.capstoneProject.caseMaterials.map((material) => <details key={material.title} className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
                <summary className="cursor-pointer text-xs font-bold text-white">{material.title}</summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-5 text-slate-300">{material.content}</pre>
              </details>)}
            </div>
            <div className="space-y-2">
              {module.capstoneProject.milestones.map((milestone, index) => <div key={milestone.title} className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
                <h5 className="text-xs font-bold text-white">Milestone {index + 1}: {milestone.title}</h5>
                <p className="mt-2 text-xs leading-5 text-slate-300">{milestone.activity}</p>
                <p className="mt-2 text-xs leading-5 text-emerald-200"><strong>Evidence to produce: </strong>{milestone.evidence}</p>
              </div>)}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Submission package</h5>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{module.capstoneProject.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Assessment rubric · 100 points</h5>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-300">{module.capstoneProject.rubric.map((criterion) => <li key={criterion.criterion}><strong className="text-white">{criterion.weight}% · {criterion.criterion}: </strong>{criterion.standard}</li>)}</ul>
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Reflection after review</h5>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">{module.capstoneProject.reflectionPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
            </div>
            <p className="text-[10px] leading-5 text-amber-200/80">This capstone is a course-design draft, not an institution-approved assessment. An educator should adapt the dataset, expected evidence, accessibility options, and marking guidance before assigning it.</p>
          </Section>
        </article>
      </div>
    </section>
  );
};

export default LearningGuide;
