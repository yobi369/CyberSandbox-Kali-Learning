# Architecture

## Current system

The repository contains two connected product surfaces: a browser-based university portal backed by a Node.js/PostgreSQL API, and a local simulated-lab experience. The application and database are not deployed and no institution is provisioned.

```text
Browser
  ├── University portal
  │     └── same-origin /api proxy
  │            └── Node.js API ── PostgreSQL
  │                  ├── sessions and institution-scoped academic records
  │                  └── research and lab metadata (no workload execution)
  └── Local simulator
        ├── curated lessons and seeded exercise data
        └── localStorage progress and formative heuristic feedback
```

## Trust boundaries

1. The browser is an untrusted client. Local storage can be edited by the learner and must never be treated as authoritative proof of completion.
2. Terminal input is parsed as text by a fixed command dispatcher. It must never be evaluated, interpolated into a shell, or passed to an operating-system process.
3. Lab definitions and outputs are educational fixtures, not observations from real hosts.
4. Third-party AI services are not called. Mentor feedback is scripted locally; browser speech uses the device's speech synthesis when available.

## Current persistence

Simulator progress and formative heuristic results are stored in browser localStorage. They are device/browser scoped, user-editable, and are not authoritative academic records. The separate portal stores institution workflows in PostgreSQL through the API. Neither the portal nor its database is currently deployed.

## Execution boundary

Live lab creation deliberately fails closed with HTTP 503. Research workspaces and experiments are metadata only; no compute worker or artifact service is connected. Any future live-lab mode must be a separately operated, opt-in subsystem with:

- authenticated API and authorization checks;
- per-user and per-lab resource quotas;
- disposable containers or virtual machines;
- no host mounts, privileged mode, Docker socket, or cloud metadata access;
- deny-by-default network policy with explicitly allowlisted lab networks;
- CPU, memory, process, disk, and wall-clock limits;
- image provenance, patching, and vulnerability scanning;
- automatic teardown and auditable lifecycle events.

The browser must not receive container runtime credentials or infrastructure secrets. Do not treat the control-plane contracts or database records as evidence that workloads execute safely.
