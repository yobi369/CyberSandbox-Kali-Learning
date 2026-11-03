import { describe, expect, it } from "vitest";
import { LABS } from "./constants";

describe("curated curriculum", () => {
  it("covers every supported difficulty", () => {
    const levels = new Set(LABS.map((lab) => lab.difficulty));
    expect(levels).toEqual(new Set(["Beginner", "Intermediate", "Advanced"]));
  });

  it("has unique lab and step identifiers", () => {
    expect(new Set(LABS.map((lab) => lab.id)).size).toBe(LABS.length);
    for (const lab of LABS) {
      const ids = lab.steps.map((step) => step.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("defines an expected command and explanation for every step", () => {
    for (const lab of LABS) {
      for (const step of lab.steps) {
        expect(step.expectedCommand?.trim()).toBeTruthy();
        expect(step.explanation.trim()).toBeTruthy();
      }
    }
  });
});
