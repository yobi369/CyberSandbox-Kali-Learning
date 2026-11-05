# Postgraduate Research Environments and Reproducibility

## Implemented records

The database now records institution-owned research projects, ethics decisions, stopped workspace metadata, experiment specifications, dataset metadata and an append-only provenance chain. Project creation, workspace registration and experiment registration append hash-linked events under a per-project transaction lock. The API requires an immutable source revision, environment digest and random seed for each experiment.

Workspaces and experiments are currently metadata-only. There is no connected compute scheduler, artifact object store, dataset upload service, notebook runtime, GPU pool or experiment execution worker. The API does not claim that an experiment has run.

## Research governance

- A project starts with ethics_status = pending.
- Only an institution administrator can record approved, rejected or not_required, with a committee reference and written rationale.
- Workspace registration is blocked until ethics is approved or documented as not required.
- Workspace and experiment creation is restricted to the principal investigator/workspace owner or institution administrator.
- Workspace quotas are bounded by server-side limits; client-supplied quota JSON is never treated as enforcement.
- Experiment records capture a Git commit, immutable environment digest, protocol and deterministic seed.
- Provenance events include sequence number, previous event hash, event hash, actor, timestamp and event payload. Updates/deletes are blocked at the database layer.

## Target workspace architecture

Use separate worker pools for:
- CPU research jobs (reproducible containers or microVMs).
- GPU jobs (explicitly scheduled hardware with institution quotas).
- High-risk malware/reverse-engineering work (dedicated isolated microVM pool with no shared storage/network).
- Collaborative notebooks (ephemeral workspace pods with per-user identity and no production secrets).

The research control plane must never execute code in the API process. Workers receive immutable job manifests and narrowly scoped artifact capabilities. Network access defaults to deny. Data access is controlled by project membership, license, consent basis and ethics approval.

## Experiment manifest

Every execution must record:
- project and experiment IDs;
- source repository and full commit SHA;
- immutable container/VM image digest and dependency lockfile;
- protocol and parameter manifest;
- random seed and RNG implementation/version;
- hardware/accelerator model and relevant driver/runtime versions;
- dataset IDs, SHA-256 checksums, licenses and consent basis;
- start/end timestamps, exit status, resource consumption and worker identity;
- output artifact checksums and a machine-readable result manifest;
- provenance chain head before and after execution.

A rerun is a new experiment record, not an overwrite. Failed and cancelled runs remain visible.

## Scientific quality gates

- Independent rerun from a clean environment reproduces declared outputs within a documented tolerance.
- Dataset splits, preprocessing, exclusion rules and holdout sets are versioned and immutable.
- Statistical tests, confidence intervals, multiple-comparison handling and effect sizes are documented.
- Research claims distinguish exploratory, calibrated, validated and independently reproduced results.
- Human review covers ethics, data provenance, method, statistical validity and limitations.
- Artifacts are access-controlled, encrypted, retained according to policy and deletable only under a documented legal/retention workflow.

## Remaining implementation

Object storage and signed upload/download URLs, dataset malware scanning, project collaborator memberships, notebook/compute providers, experiment scheduler/worker, result-manifest validation, rerun comparison, export and independent reproduction are not yet implemented.
