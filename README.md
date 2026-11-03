# CyberSandbox — Kali Learning Simulator

CyberSandbox is a browser-based learning environment for practising cybersecurity concepts through guided, deliberately simulated terminal exercises. It is designed for learners who want to understand reconnaissance, service discovery, web security, authentication controls, and defensive interpretation without pointing tools at real systems.

> **Important:** CyberSandbox is currently a front-end simulator, not a Kali Linux virtual machine. It does not execute shell commands, launch Kali tools, send network packets, brute-force credentials, exploit hosts, or provide an isolated operating-system container. Terminal results are seeded educational examples.

## What exists today

- React + TypeScript single-page learning interface.
- Three curated guided labs spanning beginner Linux foundations, intermediate reconnaissance, and advanced defensive web-surface review.
- Simulated command prompt with a small, explicitly documented command set.
- Local browser progress persistence, including assessment submissions and scores.
- Evidence-based lab assessments with per-lab weighted rubrics, criterion-level feedback, and scores kept separate from command completion and XP.
- Transparent local heuristic assessment across four dimensions: evidence quality, technical reasoning, confidence/limitations, and remediation quality. Each dimension returns a 0–4 criterion level, weighted score, explanation, and next improvement.
- Scenario-specific assessment rubrics and realistic benchmark tests for strong, weak, keyword-stuffed, overconfident, and unsafe findings.
- Scores are formative signals only. The evaluator uses explicit textual indicators and structural heuristics; it is not a semantic expert, cannot verify claims, and must not be used for formal certification or hiring decisions.
- Browser-native text-to-speech where supported.
- Curated practice scenario loading.
- Responsive workspace that prioritizes the terminal on narrow screens.
- Bounded local terminal history and command input.

## Safety boundaries

- All targets and outputs are fictional training data.
- No command is passed to the host operating system or a shell.
- Network, password-guessing, exploit, and web-scanning commands are never executed.
- The Hydra practice command deliberately withholds credentials and redirects learners to defensive controls.
- AI provider calls are disabled in the browser. Do not add API keys to Vite client environment variables or commit secrets.
- Do not use this simulator to assess systems without explicit authorization.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validation

```bash
npm run typecheck
npm test
npm run build
# or run all three gates
npm run check
```

The GitHub Actions workflow runs typechecking, unit tests, and the production build for pushes and pull requests.

## Project structure

- `App.tsx` — application shell, lab state, progress and persistence.
- `components/Terminal.tsx` — deterministic simulated command interpreter.
- `components/LabBrowser.tsx` — curriculum and practice scenario selection.
- `components/Mentor.tsx` — objective, hints and learning feedback.
- `constants.ts` — curated lab definitions and sample filesystem.
- `services/geminiService.ts` — safe local mentor/scenario fallback; remote AI is intentionally disabled.
- `services/labProgress.ts` — token-safe expected-command matching and one-time completion rewards.
- `services/labAssessment.ts` — transparent four-dimension heuristic assessment, criterion-level scoring, and targeted feedback.
- `services/labAssessment.test.ts` — realistic learner-submission benchmarks and adversarial scoring checks.
- `components/AssessmentPanel.tsx` — evidence submission, rubric display, and assessment feedback.
- `services/terminalHistory.ts` — bounded terminal history for local storage and rendering.
- `*.test.ts` — unit tests for command matching and curriculum integrity.
- `types.ts` — shared TypeScript contracts.
- `docs/ARCHITECTURE.md` — current design and planned boundaries.
- `docs/SECURITY.md` — threat model and security requirements.

## Roadmap

1. Stabilize the simulator, state model, accessibility, and test coverage.
2. Continue validating the heuristic against educator-labelled examples, add blind/manual moderation, and only introduce semantic AI grading behind a server-side, auditable, privacy-reviewed service. Never treat the current score as a formal grade.
3. Add optional authenticated server-side AI assistance with quotas and output validation.
4. Add real isolated lab execution only through disposable, network-restricted containers or VMs with explicit per-lab authorization.
5. Add learner accounts, server-side progress, instructor controls, and operational monitoring.

Items on the roadmap are not implemented unless explicitly described above.

## License

No license has been selected yet. Until a license is added, the repository's contents remain subject to the default copyright rules. Do not assume the project is open source for reuse.
