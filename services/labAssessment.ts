import type { AssessmentCriterion, LabAssessment, AssessmentResult } from "../types";

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9.+/#-]+/g, " ").trim().replace(/\\s+/g, " ");

export const scoreLabAssessment = (
  assessment: LabAssessment,
  submission: string,
  submittedAt = Date.now(),
): AssessmentResult => {
  const evidence = normalize(submission);
  const matched: string[] = [];
  const missing: string[] = [];
  const maxScore = assessment.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);

  for (const criterion of assessment.criteria) {
    const found = criterion.keywords.some((keyword) => {
      const term = normalize(keyword);
      return term.length > 0 && (evidence === term || evidence.includes(term));
    });
    (found ? matched : missing).push(criterion.id);
  }

  const score = maxScore > 0
    ? Math.round(assessment.criteria.reduce((sum, criterion) => sum + (matched.includes(criterion.id) ? criterion.weight : 0), 0) / maxScore * 100)
    : 0;

  return { score, maxScore: 100, matchedCriteria: matched, missingCriteria: missing, submittedAt };
};

export const getAssessmentFeedback = (
  assessment: LabAssessment,
  result: AssessmentResult,
): string[] => assessment.criteria
  .filter((criterion: AssessmentCriterion) => result.missingCriteria.includes(criterion.id))
  .map((criterion) => criterion.guidance);
