import { describe, expect, it } from "vitest";
import { getAssessmentFeedback, scoreLabAssessment } from "./labAssessment";
import type { LabAssessment } from "../types";
import { LABS } from "../constants";

const rubric: LabAssessment = {
  prompt: "Write a concise, evidence-based defensive finding.",
  criteria: [
    { id: "evidence", label: "Evidence quality", dimension: "evidence", signalGroups: [["apache 2.4.41", "openssh 8.2"], ["port 80", "tcp 80", "server header"]], weight: 25, guidance: "Cite exact evidence.", strongAnswer: "Record the exact banner, source, and timestamp." },
    { id: "reasoning", label: "Technical reasoning", dimension: "reasoning", signalGroups: [["fingerprinting", "service identification"], ["attack surface", "exposure"], ["because", "could allow", "may enable"]], weight: 25, guidance: "Explain the risk.", strongAnswer: "Explain the causal chain and conditions." },
    { id: "confidence", label: "Confidence and limitations", dimension: "confidence", signalGroups: [["simulated", "seeded", "not live"], ["cannot confirm", "not verified", "does not prove"]], weight: 25, guidance: "Calibrate confidence.", strongAnswer: "Identify what an authorized independent check would need to establish." },
    { id: "remediation", label: "Remediation quality", dimension: "remediation", signalGroups: [["remove the banner", "minimize banner", "hide version"], ["patch", "update"], ["review", "verify", "monitor"]], weight: 25, guidance: "Recommend a control.", strongAnswer: "Prioritize the control and define a verification check." },
  ],
};

const strongFinding = "The supplied simulated scan output observed Apache 2.4.41 in the server header on port 80. This supports service fingerprinting because an exposed version can help an attacker identify relevant attack surface and select targeted research; it does not itself establish a vulnerability. The evidence is seeded and not live, so I cannot confirm the deployed version or exploitability. In an authorized review, verify the banner and patch status, remove the unnecessary version banner, apply supported updates, and monitor the service after change.";
const weakFinding = "Apache is bad and hackers can hack it. It is definitely exploitable. Just secure it.";
const keywordStuffing = "Apache 2.4.41 port 80 fingerprinting attack surface simulated not verified remove the banner patch update review monitor. Apache 2.4.41 port 80 fingerprinting attack surface simulated not verified remove the banner patch update review monitor.";
const misleadingFinding = "The simulator proves the host is compromised and definitely exploitable. Hack back immediately and delete the server.";

describe("scoreLabAssessment against realistic learner submissions", () => {
  it("rewards a complete, qualified finding across all four dimensions", () => {
    const result = scoreLabAssessment(rubric, strongFinding, 123);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.dimensionScores.evidence).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.reasoning).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.confidence).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.remediation).toBeGreaterThanOrEqual(75);
    expect(result.submittedAt).toBe(123);
  });

  it("gives a low score to vague assertions without technical reasoning", () => {
    const result = scoreLabAssessment(rubric, weakFinding);
    expect(result.score).toBeLessThan(45);
    expect(result.dimensionScores.reasoning).toBeLessThan(50);
    expect(result.dimensionScores.confidence).toBeLessThan(50);
  });

  it("does not give a high score to keyword stuffing without a coherent explanation", () => {
    const result = scoreLabAssessment(rubric, keywordStuffing);
    expect(result.score).toBeLessThan(80);
    expect(result.dimensionScores.reasoning).toBeLessThan(75);
  });

  it("penalizes overconfident and unsafe conclusions", () => {
    const result = scoreLabAssessment(rubric, misleadingFinding);
    expect(result.dimensionScores.confidence).toBeLessThan(50);
    expect(result.dimensionScores.remediation).toBeLessThan(50);
  });

  it("returns criterion-level feedback and actionable next steps", () => {
    const result = scoreLabAssessment(rubric, weakFinding);
    expect(getAssessmentFeedback(rubric, result)).toHaveLength(4);
    expect(result.feedback.every((item) => item.nextStep.length > 20)).toBe(true);
  });

  it("returns zero for empty or unrelated submissions", () => {
    expect(scoreLabAssessment(rubric, "   ").score).toBe(0);
    expect(scoreLabAssessment(rubric, "Everything is secure.").score).toBe(0);
  });
});

describe("scenario-specific rubric calibration", () => {
  it("recognizes a careful Linux foundations report", () => {
    const lab = LABS.find((item) => item.id === "linux-foundations");
    if (!lab?.assessment) throw new Error("Linux assessment fixture missing");
    const submission = "whoami returned the training user and pwd showed the working directory /home/kali; notes.txt was the local exercise file. DNS maps a domain name to records such as an IP address because clients need a destination before connecting. The displayed lab.example.test answer is simulated example data and no DNS request was sent, so I cannot confirm any live record. In an authorized environment I would query the approved resolver, record the result and TTL, and compare it with the expected zone data.";
    const result = scoreLabAssessment(lab.assessment, submission);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.dimensionScores.evidence).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.reasoning).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.confidence).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.remediation).toBeGreaterThanOrEqual(75);
  });

  it("recognizes a defensible defensive-web report", () => {
    const lab = LABS.find((item) => item.id === "defensive-web-observation");
    if (!lab?.assessment) throw new Error("Web assessment fixture missing");
    const submission = "The supplied simulated scanner output observed an Apache 2.4.41 server header. This can support service fingerprinting because the version may help prioritize targeted research, but the header alone does not prove a vulnerability or compromise. The output is seeded and not live, so I cannot confirm the deployed version; an authorized review would verify the actual response and vendor patch status. Remediation is to apply supported updates, remove unnecessary version disclosure, and verify the response header after the change.";
    const result = scoreLabAssessment(lab.assessment, submission);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.dimensionScores.evidence).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.reasoning).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.confidence).toBeGreaterThanOrEqual(75);
    expect(result.dimensionScores.remediation).toBeGreaterThanOrEqual(75);
  });
});
