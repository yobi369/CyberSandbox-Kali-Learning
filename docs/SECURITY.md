# Security Notes and Threat Model

## Scope

This document describes the current browser-only simulator. It is not a certification or a claim that the application is production-ready.

## Assets

- Learner progress and locally stored notes.
- Browser session integrity and availability.
- Any future AI provider credentials and lab infrastructure.
- The integrity of exercise definitions and educational output.

## Threats and controls

| Threat | Current control | Remaining limitation |
|---|---|---|
| User enters shell metacharacters | Fixed command dispatch; no shell execution | Expand parser tests and input limits |
| Learner mistakes fixture output for a real scan | UI and terminal label results as simulated | Audit every curriculum instruction and output |
| API key exposed in browser bundle | Browser-side Gemini SDK removed | Secure backend integration is not implemented |
| Corrupt local progress crashes app | Parse errors handled; basic shape checks | Validation is intentionally lightweight |
| Learner tampers with XP/completion | Progress is local only | No server-side authority or integrity |
| Resource exhaustion from huge history | Not yet bounded | Add history and storage quotas |
| Unsafe real-world target scanning | No network execution exists | Any future real-lab mode needs isolation and authorization |

## Mandatory requirements before real execution

- Never execute arbitrary user-supplied commands on the application host.
- Do not mount host filesystems, credentials, Docker sockets, or cloud metadata endpoints into labs.
- Deny outbound network traffic by default.
- Restrict labs to owned, disposable targets on isolated networks.
- Apply per-session resource and time limits.
- Destroy lab resources after the session and verify teardown.
- Add authentication, authorization, audit logging, abuse controls, and incident procedures.
- Keep AI credentials server-side; validate and constrain model output before rendering or using it.
- Add dependency scanning, secret scanning, and security-focused regression tests.

## Responsible use

Use the simulator for education. Any future live testing capability must require explicit authorization for the target and must be technically constrained to the approved lab environment.
