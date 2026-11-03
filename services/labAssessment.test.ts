import { describe, expect, it } from "vitest";
import { getAssessmentFeedback, scoreLabAssessment } from "./labAssessment";
import type { LabAssessment } from "../types";

const rubric: LabAssessment = {
  prompt: "Write a concise finding.",
  criteria: [
    { id: "evidence", label: "Cite an observation", keywords: ["apache 2.4.41", "version disclosure"], weight: 35, guidance: "Name the exact observed service or version." },
    { id: "impact", label: "Explain impact", keywords: ["fingerprinting", "targeted research"], weight: 30, guidance: "Explain how disclosure can aid service fingerprinting." },
    { id: "remediation", label: "Recommend remediation", keywords: ["minimize banners", "patch management"], weight: 35, guidance: "Recommend reducing unnecessary banners and maintaining patches." },
  ],
};

describe("scoreLabAssessment", () => {
  it("awards full marks when all evidence criteria are addressed", () => {
    const result = scoreLabAssessment(rubric, "Apache 2.4.41 version disclosure supports fingerprinting and targeted research. Minimize banners and use patch management.", 123);
    expect(result.score).toBe(100);
    expect(result.matchedCriteria).toHaveLength(3);
    expect(result.submittedAt).toBe(123);
    expect(result.submission).toContain("Apache 2.4.41");
  });

  it("awards partial marks and identifies missing criteria", () => {
    const result = scoreLabAssessment(rubric, "Apache 2.4.41 was observed.", 456);
    expect(result.score).toBe(35);
    expect(result.missingCriteria).toEqual(["impact", "remediation"]);
    expect(getAssessmentFeedback(rubric, result)).toHaveLength(2);
  });

  it("does not award marks for empty or unrelated submissions", () => {
    expect(scoreLabAssessment(rubric, "   ").score).toBe(0);
    expect(scoreLabAssessment(rubric, "Everything is secure.").score).toBe(0);
  });
});
