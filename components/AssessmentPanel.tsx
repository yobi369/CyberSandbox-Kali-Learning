import React, { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import type { AssessmentDimension, AssessmentResult, Lab } from "../types";
import { scoreLabAssessment } from "../services/labAssessment";

interface AssessmentPanelProps {
  lab: Lab;
  completed: boolean;
  result?: AssessmentResult;
  onSubmit: (result: AssessmentResult) => void;
}

const DIMENSIONS: { id: AssessmentDimension; label: string; description: string }[] = [
  { id: "evidence", label: "Evidence quality", description: "Specific observations, traceability and source context." },
  { id: "reasoning", label: "Technical reasoning", description: "A plausible causal explanation, not just a risk label." },
  { id: "confidence", label: "Confidence & limits", description: "Calibrated certainty and explicit unknowns." },
  { id: "remediation", label: "Remediation", description: "Proportionate controls and a way to verify them." },
];

const AssessmentPanel: React.FC<AssessmentPanelProps> = ({ lab, completed, result, onSubmit }) => {
  const assessment = lab.assessment;
  const [submission, setSubmission] = useState("");
  useEffect(() => { setSubmission(result?.submission ?? ""); }, [result?.submission]);
  if (!assessment) return null;

  const submit = () => {
    if (!completed || submission.trim().length < 80) return;
    onSubmit(scoreLabAssessment(assessment, submission.trim()));
  };

  return (
    <section aria-labelledby={`assessment-title-${lab.id}`} className="mt-4 rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-violet-300"><ClipboardCheck size={17}/><h2 id={`assessment-title-${lab.id}`} className="text-xs font-black uppercase tracking-widest">Analyst assessment</h2></div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{assessment.prompt}</p>
        </div>
        {result && <div className="shrink-0 text-right"><div className="text-2xl font-black text-white tabular-nums">{result.score}%</div><div className="text-[9px] uppercase tracking-widest text-slate-500">Formative score</div></div>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {DIMENSIONS.map((dimension) => (
          <div key={dimension.id} className="rounded-xl border border-white/5 bg-slate-900/70 p-3">
            <div className="text-[10px] font-bold text-slate-200">{dimension.label}</div>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-500">{dimension.description}</p>
            {result && <div className="mt-2 text-lg font-black text-violet-200 tabular-nums">{result.dimensionScores[dimension.id]}%</div>}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor={`assessment-${lab.id}`} className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Your technical finding</label>
        <p className="text-[10px] leading-relaxed text-slate-500">Use a short report structure: observation and source → technical interpretation → confidence and limitations → recommended action and verification. Do not invent facts that are absent from the sample output.</p>
        <textarea id={`assessment-${lab.id}`} value={submission} onChange={(event) => setSubmission(event.target.value.slice(0, 2400))} minLength={80} maxLength={2400} rows={7} placeholder="Observation: exact output and source. Analysis: why it matters and required conditions. Confidence: what the simulated evidence does not prove. Recommendation: defensive action and verification." className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Detailed rubric feedback</span><button type="button" onClick={() => setSubmission("")} className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white"><RotateCcw size={11}/> Clear draft</button></div>
        {result.feedback.map((item) => {
          const criterion = assessment.criteria.find((entry) => entry.id === item.criterionId);
          return <article key={item.criterionId} className="rounded-lg border border-white/5 bg-slate-950/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-200">{criterion?.label ?? item.criterionId}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${item.level >= 3 ? "text-emerald-300" : item.level >= 2 ? "text-amber-300" : "text-rose-300"}`}>{item.level}/4 · {item.score} weighted points</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-300">{item.feedback}</p>
            <p className="mt-2 text-[10px] leading-relaxed text-violet-200"><strong>Next improvement:</strong> {item.nextStep}</p>
          </article>;
        })}
        <p className="text-[9px] leading-relaxed text-slate-500">This is a transparent local heuristic, not semantic expert grading. It cannot verify the truth of an observation or fully understand nuanced reasoning. Scores are formative and should not be used as formal certification results.</p>
      </div>}
    </section>
  );
};

export default AssessmentPanel;
