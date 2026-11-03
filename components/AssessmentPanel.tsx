import React, { useState } from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import type { AssessmentResult, Lab } from "../types";
import { getAssessmentFeedback, scoreLabAssessment } from "../services/labAssessment";

interface AssessmentPanelProps {
  lab: Lab;
  completed: boolean;
  result?: AssessmentResult;
  onSubmit: (result: AssessmentResult) => void;
}

const AssessmentPanel: React.FC<AssessmentPanelProps> = ({ lab, completed, result, onSubmit }) => {
  const assessment = lab.assessment;
  const [submission, setSubmission] = useState("");
  if (!assessment) return null;

  const feedback = result ? getAssessmentFeedback(assessment, result) : [];
  const submit = () => {
    if (!completed || submission.trim().length < 30) return;
    onSubmit(scoreLabAssessment(assessment, submission.trim()));
  };

  return (
    <section aria-labelledby="assessment-title" className="mt-4 rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-violet-300"><ClipboardCheck size={17}/><h2 id="assessment-title" className="text-xs font-black uppercase tracking-widest">Evidence assessment</h2></div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{assessment.prompt}</p>
        </div>
        {result && <div className="shrink-0 text-right"><div className="text-2xl font-black text-white tabular-nums">{result.score}%</div><div className="text-[9px] uppercase tracking-widest text-slate-500">Rubric score</div></div>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {assessment.criteria.map((criterion) => {
          const met = result?.matchedCriteria.includes(criterion.id) ?? false;
          return <div key={criterion.id} className="rounded-xl border border-white/5 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-200">{criterion.label}</span><span className="text-[9px] text-slate-500">{criterion.weight} pts</span></div>
            {result && <div className={`mt-2 flex items-center gap-1 text-[9px] font-bold uppercase ${met ? "text-emerald-400" : "text-amber-300"}`}><CheckCircle2 size={11}/>{met ? "Addressed" : "Needs work"}</div>}
          </div>;
        })}
      </div>

      <label htmlFor={`assessment-${lab.id}`} className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Your finding</label>
      <textarea id={`assessment-${lab.id}`} value={submission} onChange={(event) => setSubmission(event.target.value.slice(0, 1200))} minLength={30} maxLength={1200} rows={4} placeholder="State what the sample evidence shows, why it matters, how confident you are, and what defensive action you recommend..." className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-violet-400/60" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[9px] text-slate-500">{submission.length}/1200 characters · minimum 30 · deterministic keyword rubric</span>
        <button type="button" onClick={submit} disabled={!completed || submission.trim().length < 30} className="rounded-lg bg-violet-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">Score finding</button>
      </div>
      {!completed && <p className="text-[10px] text-amber-300">Complete the guided command steps to unlock assessment submission. This score is separate from command completion and XP.</p>}
      {result && <div aria-live="polite" className="rounded-xl border border-white/10 bg-slate-900/70 p-3 space-y-2">
        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Rubric feedback</span><button type="button" onClick={() => setSubmission("")} className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white"><RotateCcw size={11}/> New attempt</button></div>
        {feedback.length ? <ul className="list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-amber-200">{feedback.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-[10px] text-emerald-300">All rubric criteria were identified in this submission. Review the wording for accuracy and support before treating it as a real-world finding.</p>}
        <p className="text-[9px] text-slate-500">Scored locally from text matches; this is formative guidance, not expert review or proof that the underlying observation is true.</p>
      </div>}
    </section>
  );
};

export default AssessmentPanel;
