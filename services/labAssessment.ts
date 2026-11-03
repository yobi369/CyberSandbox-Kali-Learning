import type {
  AssessmentCriterion,
  AssessmentDimension,
  AssessmentFeedbackItem,
  AssessmentResult,
  LabAssessment,
} from "../types";

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9.+/#:-]+/g, " ").trim().replace(/\s+/g, " ");

const hasAny = (text: string, terms: string[]): boolean =>
  terms.some((term) => normalize(term).length > 0 && text.includes(normalize(term)));

const countMatchedGroups = (text: string, groups: string[][]): number =>
  groups.filter((group) => hasAny(text, group)).length;

const QUALITY_SIGNALS: Record<AssessmentDimension, { strong: string[]; weak: string[] }> = {
  evidence: {
    strong: ["observed", "output showed", "sample reported", "the banner returned", "the record lists", "the scan displayed", "in the supplied output"],
    weak: ["i think", "probably", "obviously", "everyone knows"],
  },
  reasoning: {
    strong: ["because", "therefore", "this means", "which could", "which may", "as a result", "increases the risk", "would allow"],
    weak: ["is bad", "is dangerous", "hackers can hack", "very vulnerable"],
  },
  confidence: {
    strong: ["cannot confirm", "not enough evidence", "not verified", "would need to verify", "confidence is", "the limitation", "simulated", "seeded", "does not prove"],
    weak: ["definitely exploitable", "guaranteed", "certainly compromised", "proves the server is hacked"],
  },
  remediation: {
    strong: ["restrict access", "apply patches", "update the server", "disable unnecessary", "review firewall", "enable mfa", "monitor authentication", "remove the banner", "enforce access control", "verify configuration", "verify the result", "document the result", "query approved resolver"],
    weak: ["hack back", "exploit it", "delete the server", "just secure it"],
  },
};

const DIMENSION_FEEDBACK: Record<AssessmentDimension, { low: string; middle: string; high: string }> = {
  evidence: {
    low: "The finding does not yet anchor its claims in a specific observation from the exercise.",
    middle: "There is a relevant observation, but it needs a precise value, source, or context so another analyst can reproduce it.",
    high: "The report identifies concrete exercise evidence and distinguishes the observation from an assumption.",
  },
  reasoning: {
    low: "The report states a conclusion but does not explain the technical relationship between the observation and its possible impact.",
    middle: "The impact is plausible, but the causal explanation or conditions are incomplete.",
    high: "The report explains a plausible causal path and avoids treating exposure as proof of compromise.",
  },
  confidence: {
    low: "The report overstates certainty or omits important evidence limitations.",
    middle: "Some uncertainty is acknowledged, but the report should say exactly what remains unverified.",
    high: "The report calibrates confidence and identifies what the supplied evidence cannot establish.",
  },
  remediation: {
    low: "The recommendation is missing, vague, or disproportionate to the evidence.",
    middle: "A useful control is named, but it needs to be tied to the observed risk and prioritized.",
    high: "The recommendation is actionable, proportionate, and connected to the finding.",
  },
};

const NEXT_STEPS: Record<AssessmentDimension, string> = {
  evidence: "Quote the exact sample observation (for example, a port, service banner, HTTP header, DNS record, or file path) and identify where it came from.",
  reasoning: "Write one or two sentences connecting the observation to a realistic security consequence, including the conditions required for that consequence.",
  confidence: "Separate fact, inference, and unknown. State that this is seeded simulator output and name the independent check needed in an authorized environment.",
  remediation: "Choose a specific preventive or detective control, explain who should apply it, and state how its effectiveness could be verified.",
};

const scoreCriterion = (criterion: AssessmentCriterion, text: string, original: string): AssessmentFeedbackItem => {
  const groupCount = Math.max(1, criterion.signalGroups.length);
  const matchedGroups = countMatchedGroups(text, criterion.signalGroups);
  const coverage = matchedGroups / groupCount;
  const dimension = criterion.dimension;
  const strongSignal = hasAny(text, QUALITY_SIGNALS[dimension].strong);
  const weakSignal = hasAny(text, QUALITY_SIGNALS[dimension].weak);

  let level = Math.round(coverage * 3);
  if (strongSignal && coverage > 0) level += 1;
  if (weakSignal) level -= 1;

  if (dimension === "evidence") {
    const concreteDetail = /\b(port|tcp|udp)\s*\d{1,5}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|\b(?:apache|openssh|nginx)\s*[0-9]/i.test(original);
    if (concreteDetail && coverage > 0) level += 1;
    if (original.length < 55) level = Math.min(level, 1);
  }
  if (dimension === "reasoning" && !strongSignal) level = Math.min(level, 2);
  if (dimension === "confidence" && weakSignal) level = Math.min(level, 1);
  if (dimension === "remediation" && !strongSignal) level = Math.min(level, 2);

  level = Math.max(0, Math.min(4, level));
  const feedback = level >= 3
    ? DIMENSION_FEEDBACK[dimension].high
    : level >= 2
      ? DIMENSION_FEEDBACK[dimension].middle
      : DIMENSION_FEEDBACK[dimension].low;

  return {
    criterionId: criterion.id,
    dimension,
    level: level as 0 | 1 | 2 | 3 | 4,
    score: Math.round((criterion.weight * level) / 4),
    feedback,
    nextStep: level >= 3 ? criterion.strongAnswer : NEXT_STEPS[dimension],
  };
};

export const scoreLabAssessment = (
  assessment: LabAssessment,
  submission: string,
  submittedAt = Date.now(),
): AssessmentResult => {
  const text = normalize(submission);
  const feedback = assessment.criteria.map((criterion) => scoreCriterion(criterion, text, submission));
  const totalWeight = assessment.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const rawScore = feedback.reduce((sum, item) => sum + item.score, 0);
  const dimensionScores = (["evidence", "reasoning", "confidence", "remediation"] as AssessmentDimension[])
    .reduce((scores, dimension) => {
      const related = assessment.criteria.filter((criterion) => criterion.dimension === dimension);
      const weight = related.reduce((sum, criterion) => sum + criterion.weight, 0);
      const earned = feedback.filter((item) => item.dimension === dimension).reduce((sum, item) => sum + item.score, 0);
      scores[dimension] = weight ? Math.round((earned / weight) * 100) : 0;
      return scores;
    }, {} as Record<AssessmentDimension, number>);
  const criterionScores = Object.fromEntries(feedback.map((item) => [item.criterionId, item.level]));
  const matchedCriteria = feedback.filter((item) => item.level >= 2).map((item) => item.criterionId);
  const missingCriteria = feedback.filter((item) => item.level < 2).map((item) => item.criterionId);

  return {
    submission: submission.trim(),
    score: totalWeight ? Math.round((rawScore / totalWeight) * 100) : 0,
    maxScore: 100,
    dimensionScores,
    criterionScores,
    matchedCriteria,
    missingCriteria,
    feedback,
    submittedAt,
  };
};

export const getAssessmentFeedback = (
  _assessment: LabAssessment,
  result: AssessmentResult,
): AssessmentFeedbackItem[] => result.feedback;
