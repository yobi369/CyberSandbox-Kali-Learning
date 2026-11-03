import { TerminalLine } from "../types";

export const MAX_TERMINAL_HISTORY_LINES = 500;
export const MAX_TERMINAL_LINE_LENGTH = 4000;

/** Append a line while keeping local history bounded for storage and rendering. */
export const appendTerminalLine = (
  history: readonly TerminalLine[],
  line: TerminalLine,
  maxLines = MAX_TERMINAL_HISTORY_LINES,
): TerminalLine[] => {
  const safeMax = Math.max(1, Math.floor(maxLines));
  const boundedLine = {
    ...line,
    content: line.content.slice(0, MAX_TERMINAL_LINE_LENGTH),
  };
  return [...history, boundedLine].slice(-safeMax);
};
