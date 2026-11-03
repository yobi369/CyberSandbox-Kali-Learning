import { Lab } from "../types";
import { LABS } from "../constants";

/**
 * AI integrations are intentionally disabled until a trusted server-side
 * API proxy, authentication, rate limits, and abuse controls are implemented.
 * This client-side fallback keeps the learning experience usable without
 * exposing provider credentials in a browser bundle.
 */
export const generateMission = async (difficulty: string): Promise<Lab> => {
  const requested = LABS.find((lab) => lab.difficulty === difficulty);
  const selected = requested ?? LABS[0];
  return {
    ...selected,
    id: `${selected.id}-practice-${Date.now()}`,
    title: `${selected.title} — Practice Run`,
    objectives: [...selected.objectives],
    hints: [...selected.hints],
    steps: selected.steps.map((step) => ({ ...step })),
  };
};

export const getMentorResponse = async (
  userCommand: string,
  output: string,
  currentLab: Lab | null,
): Promise<string> => {
  if (!currentLab) return "Choose a lab to begin. All terminal activity is simulated locally.";
  if (output.startsWith("bash:") || output.startsWith("Unknown command")) {
    return "That command is not implemented in this simulator. Use help to review the supported learning commands.";
  }
  return `Practice feedback: review the output of “${userCommand}”, compare it with the objective, and record what the result tells you about the lab environment. This is simulated output, not a real system scan.`;
};

/** Uses the browser's built-in speech engine; no remote audio service or key. */
export const speakInstruction = (text: string): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.85;
  window.speechSynthesis.speak(utterance);
};
