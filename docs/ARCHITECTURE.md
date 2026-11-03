# Architecture

## Current system

CyberSandbox is a client-rendered React application built with Vite and TypeScript. It currently has no application server, database, authentication layer, or container runtime.

```text
Browser
  ├── App state and local progress
  ├── LabBrowser (curated curriculum)
  ├── Mentor (objective and learning guidance)
  └── Terminal (deterministic command simulator)
         └── seeded exercise data only
```

## Trust boundaries

1. The browser is an untrusted client. Local storage can be edited by the learner and must never be treated as authoritative proof of completion.
2. Terminal input is parsed as text by a fixed command dispatcher. It must never be evaluated, interpolated into a shell, or passed to an operating-system process.
3. Lab definitions and outputs are educational fixtures, not observations from real hosts.
4. Third-party AI services are not called from the browser. Any future provider integration must be mediated by a server-side API.

## Current persistence

Progress is stored in browser localStorage. It is device/browser scoped, user-editable, and not encrypted or synchronized. The application validates the basic shape of loaded state and falls back to a fresh session if parsing fails.

## Planned execution architecture

A future real-lab mode must be a separate, opt-in subsystem:

- authenticated API and authorization checks;
- per-user and per-lab resource quotas;
- disposable containers or virtual machines;
- no host mounts, privileged mode, Docker socket, or cloud metadata access;
- deny-by-default network policy with explicitly allowlisted lab networks;
- CPU, memory, process, disk, and wall-clock limits;
- image provenance, patching, and vulnerability scanning;
- automatic teardown and auditable lifecycle events.

The browser must not receive container runtime credentials or infrastructure secrets.
