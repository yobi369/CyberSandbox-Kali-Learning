import { describe, expect, it } from "vitest";
import { matchesExpectedCommand } from "./labProgress";

describe("matchesExpectedCommand", () => {
  it("matches a complete command token", () => {
    expect(matchesExpectedCommand("nmap -sV 10.5.0.1", "nmap")).toBe(true);
  });

  it("does not match a partial command token", () => {
    expect(matchesExpectedCommand("nmapx 10.5.0.1", "nmap")).toBe(false);
  });

  it("does not treat a command name appearing as an argument as execution", () => {
    expect(matchesExpectedCommand("echo nmap", "nmap")).toBe(false);
  });

  it("matches an expected multi-token command at the beginning", () => {
    expect(matchesExpectedCommand("nmap 10.5.0.1 -sV", "nmap 10.5.0.1")).toBe(true);
  });

  it("does not accept a partial multi-token target", () => {
    expect(matchesExpectedCommand("nmap 10.5.0.10", "nmap 10.5.0.1")).toBe(false);
  });

  it("normalizes case and repeated whitespace", () => {
    expect(matchesExpectedCommand("  NMAP   -SN  10.5.0.1 ", " -sn ")).toBe(true);
  });

  it("rejects blank commands and missing expectations", () => {
    expect(matchesExpectedCommand("   ", "nmap")).toBe(false);
    expect(matchesExpectedCommand("nmap", undefined)).toBe(false);
  });
});

import { isFirstLabCompletion } from "./labProgress";

describe("isFirstLabCompletion", () => {
  it("allows a first completion", () => {
    expect(isFirstLabCompletion("linux-foundations", [])).toBe(true);
  });

  it("does not award a duplicate completion", () => {
    expect(isFirstLabCompletion("linux-foundations", ["linux-foundations"])).toBe(false);
  });

  it("does not confuse distinct labs", () => {
    expect(isFirstLabCompletion("defensive-web-observation", ["linux-foundations"])).toBe(true);
  });
});
