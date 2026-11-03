# Assessment design and validation

## Purpose and status

The assessment engine provides formative feedback on short learner-authored technical findings. It is deliberately transparent and deterministic. It is **not** a semantic evaluator, expert reviewer, certification authority, or evidence-verification system.

The current application runs entirely in the browser. Assessment submissions and scores are stored in local browser storage; there is no instructor moderation service or server-side audit record.

## Four assessment dimensions

Each lab rubric assigns weighted criteria to four dimensions. The current authored rubrics use equal weighting (25% each), so a strong score in one area cannot conceal a missing dimension.

| Dimension | What a strong response demonstrates | Common weakness |
| --- | --- | --- |
| Evidence quality | Exact observation, value, source/context, and clear separation of observation from inference | Generic claims with no reproducible detail |
| Technical reasoning | Plausible causal relationship between the observation and impact, including conditions and scope | Naming a risk without explaining how it could arise |
| Confidence and limitations | Calibrated certainty, explicit unknowns, and a suitable independent verification step | Treating simulated output or exposure as proof of compromise |
| Remediation | Specific, proportionate preventive/detective action and a verification method | Vague advice such as "make it secure" or disproportionate action |

## Criterion scale

Every criterion is evaluated on a 0–4 heuristic scale:

- **0 — Absent/contradictory:** no relevant support, or a materially unsafe/overconfident statement.
- **1 — Weak:** a relevant term or assertion appears, but no meaningful explanation or supporting detail.
- **2 — Developing:** the response addresses the criterion, but leaves important context, causal reasoning, or verification unspecified.
- **3 — Proficient:** the response gives a coherent explanation and relevant support.
- **4 — Strong:** the response is specific, calibrated, proportionate, and includes a useful verification or next step.

The weighted score is normalized to 0–100. The UI also exposes each dimension score and criterion feedback so learners can see where marks came from.

## How the current evaluator works

The local evaluator combines:
- Scenario-specific signal groups (sets of equivalent phrases relevant to the lab).
- Dimension-specific language indicators (for example, causal explanation, uncertainty, or actionable controls).
- Basic structure and evidence-detail heuristics.
- Penalties for overconfident or unsafe conclusions.
- Criterion-specific feedback and next-step guidance.

The evaluator does not execute code, inspect a live target, check a CVE database, verify a patch, or establish that a learner's claim is true. Text indicators are proxies for rubric coverage, not proof of understanding. A learner can still game a heuristic with carefully arranged language; educators should treat the result as a coaching signal.

## Benchmark cases

The automated test suite includes representative synthetic learner submissions:

1. **Strong finding:** identifies a specific sample banner and port, explains how it supports fingerprinting without claiming exploitation, marks the evidence as simulated, and recommends proportionate verification and patching.
2. **Weak finding:** uses vague labels such as "bad" or "hackers can hack" without a causal explanation.
3. **Keyword stuffing:** repeats rubric vocabulary without constructing a meaningful argument.
4. **Misleading finding:** claims the simulator proves compromise and recommends retaliatory or destructive action.
5. **Linux foundations report:** explains user/directory context, DNS name-to-record resolution, the no-live-query boundary, and authorized verification.
6. **Defensive web report:** identifies a sample server header, explains information-disclosure implications, qualifies confidence, and proposes patching/banner minimization with verification.

These are regression fixtures, not an externally validated dataset. They do not establish statistical accuracy, fairness, or educational validity.

## Required next validation before formal grading

1. Recruit at least two cybersecurity educators/reviewers to independently score a diverse, anonymized submission set using the written rubric.
2. Include novice, intermediate, expert, concise, verbose, multilingual, typo-heavy, adversarial, and technically incorrect submissions.
3. Compare automated dimension scores with reviewer consensus; report agreement, false-positive rates, false-negative rates, and examples of systematic bias.
4. Revise rubrics and thresholds based on documented disagreement, not intuition alone.
5. Keep human review available for borderline, disputed, or high-stakes outcomes.
6. Version every rubric and scoring algorithm; retain a transparent explanation of which version produced each score.
7. Do not use these scores for certification, hiring, discipline, or other consequential decisions without a separately validated and governed assessment process.

## Learning-depth standard for every lab

A lab should not be considered complete merely because learners can type a command. Each substantial lab should eventually include:

1. **Prerequisite concepts:** definitions, mental models, protocols, and relevant security principles.
2. **Command anatomy:** syntax, flags, arguments, safe defaults, and what the command does not do.
3. **Worked example:** expected output with each important field explained.
4. **Evidence interpretation:** observation vs inference vs hypothesis, confidence, false positives, and limitations.
5. **Defensive relevance:** how defenders use the knowledge, relevant controls, and safe operational boundaries.
6. **Common mistakes:** realistic errors, why they happen, and how to diagnose them.
7. **Guided practice:** progressively less scaffolding, with meaningful checkpoints.
8. **Independent exercise:** a new but related scenario, not a copy of the worked example.
9. **Evidence-based assessment:** a finding, a reasoned interpretation, calibrated confidence, remediation, and verification.
10. **Further study:** authoritative references and extension exercises.

The existing labs are a foundation, not yet a complete deep-learning curriculum. The next curriculum pass should expand each lab against this standard and add separate beginner-to-advanced modules rather than merely increasing the number of commands.
