import { describe, expect, it } from "vitest";
import { appendTerminalLine, MAX_TERMINAL_LINE_LENGTH } from "./terminalHistory";
import { TerminalLine } from "../types";

const line = (id: string, content = id): TerminalLine => ({
  id,
  type: "output",
  content,
  timestamp: Number(id) || 0,
});

describe("appendTerminalLine", () => {
  it("keeps only the newest lines when the limit is reached", () => {
    const history = [line("1"), line("2"), line("3")];
    expect(appendTerminalLine(history, line("4"), 3).map((item) => item.id))
      .toEqual(["2", "3", "4"]);
  });

  it("truncates oversized line content", () => {
    const appended = appendTerminalLine([], line("large", "x".repeat(MAX_TERMINAL_LINE_LENGTH + 1)));
    expect(appended[0].content).toHaveLength(MAX_TERMINAL_LINE_LENGTH);
  });

  it("does not mutate the prior history array", () => {
    const history = [line("1")];
    appendTerminalLine(history, line("2"));
    expect(history).toHaveLength(1);
  });
});
