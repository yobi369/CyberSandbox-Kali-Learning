# Isolated Kali Worker Deployment Runbook

## Deployment status

The application currently has a lab-definition registry and a database control-plane schema for sessions, quotas, lifecycle events and teardown evidence. The HTTP API deliberately returns 503 for live session creation.

There is no deployed VM provider, worker host, virtual network, image registry or remote session gateway. No Kali VM is created by this repository today.

This is a security boundary, not a temporary UI limitation. Do not change the API to return a successful session until every release gate below is independently tested.

## Runtime decision

**Pilot: one dedicated KVM-capable Linux host using libvirt/QEMU, with one isolated VM per learner session.**

**Scale path: Firecracker microVMs on dedicated KVM hosts**, after the pilot has validated the worker protocol, image pipeline, network policy, lifecycle, monitoring and teardown evidence.

The initial supervised cohort is capped at five concurrent learners. This is a rollout limit, not a claim about host capacity. Measure peak CPU, memory, disk and network use on the selected hardware before authorising any cohort.

The detailed MVP host specification, preflight checks, network model, resource envelope and release gates are maintained in [KVM/QEMU Pilot Host Foundation](KVM_QEMU_PILOT_FOUNDATION.md).

## Target execution model

Control plane:

- API authenticates the learner and checks course enrolment, lab approval, institution policy and concurrent-session quotas.
- The orchestrator creates a durable requested session record and a short-lived opaque session capability.
- A separate worker controller receives an authenticated, tenant-scoped and replay-resistant job. It has no application database credentials.
- The controller uses a restricted local libvirt interface to create a fresh QEMU/KVM guest from an immutable, digest-pinned Kali image.
- The guest receives an ephemeral copy-on-write disk overlay. The golden base image remains read-only.
- A per-session isolated virtual network connects Kali only to explicitly approved vulnerable targets attached to that same session.
- A separate gateway brokers browser terminal access. It does not expose SSH, VNC, libvirt or worker management ports directly.
- The session expiry controller and orphan reconciler operate independently of browser connections and destroy expired or abandoned resources.

Do not run learner workloads inside the public web/API process, a shared application container, or a Docker socket exposed to the API.

## Host prerequisites

- Dedicated bare-metal KVM-capable Linux host with hardware virtualisation enabled and `/dev/kvm` verified.
- Supported Linux kernel, cgroups v2, seccomp, namespaces and AppArmor/SELinux confinement.
- QEMU/KVM and libvirt installed from supported distribution packages and maintained through a documented patch process.
- Dedicated unprivileged worker identity; no routine QEMU execution as root.
- Separate management and lab network interfaces or equivalently enforced network zones.
- Host-enforced IPv4 and IPv6 deny-by-default policy.
- Encrypted ephemeral storage with a documented destruction method.
- Monitoring, time synchronisation, centralised security logs and out-of-band recovery.
- Private artifact storage with signed image provenance, SBOMs, vulnerability scan results and immutable SHA-256 digests.

Do not assume a generic VPS supports KVM. Verify provider support and independently test isolation before using a virtualised host.

## Required default policy

- Egress is deny-by-default for every learner network.
- No public internet, institution LAN, cloud metadata route, control-plane, database, worker management or other tenant access.
- Only explicitly approved lab targets on the same session's isolated virtual network may be reachable.
- No host networking, privileged guest, host mounts, runtime sockets, arbitrary device passthrough or cross-session network path.
- CPU, memory, disk, process count, file descriptor count, bandwidth and wall-clock limits are enforced by the host.
- Session capability is bound to one user, one tenant, one session and a short expiry; revoke it on stop, failure or expiry.
- No learner-selected image URL, arbitrary libvirt XML, arbitrary shell command or host path is accepted by the worker controller.

## Lifecycle and failure handling

Allowed transitions:

`requested -> authorized -> provisioning -> ready -> active -> stopping -> destroying -> destroyed`

Any stage may transition to `failed` or `expired`. A row marked destroyed must have `destroyed_at` and `teardown_verified = true`, backed by worker evidence.

The worker must be idempotent. Repeated stop/destroy requests cannot create new resources. Persist provider resource IDs before exposing the session. On timeout, worker crash or lost control-plane connection, a separate reconciler enumerates provider resources by immutable session labels and destroys orphans.

A session must not be marked ready until the VM, isolated network policy and terminal route are confirmed. If any component is unavailable or ambiguous, the API must fail closed and keep the session unavailable.

## Security acceptance tests (release blockers)

1. Two concurrent tenants cannot see, connect to or address one another's guest or artifacts.
2. Guest traffic to the public internet, RFC1918 institution ranges, IPv6 external routes, link-local metadata and control-plane endpoints is denied.
3. Host mounts, host networking, privileged mode, KVM device access from the guest, runtime sockets and management ports are unavailable.
4. CPU, memory, disk, process, bandwidth and wall-clock limits are enforced under adversarial load.
5. Kill the worker during every provisioning and teardown transition; prove no orphaned VM, tap device, bridge rule, volume or capability remains.
6. Restart the API, controller and host independently; reconcile durable session state without duplicate VMs.
7. Verify image signatures/digests and reject mutable tags or unapproved images.
8. Verify logs contain no passwords, session capabilities, student submission bodies or sensitive guest data.
9. Run independent VM escape, network segmentation and control-plane penetration tests.
10. Prove backup/restore and secure destruction for session metadata and artifacts.
11. Verify browser terminal connections cannot cross user, tenant or session boundaries.
12. Demonstrate an emergency kill switch that revokes access and terminates all active sessions.

## Operational rollout

- Stage 0: metadata-only lab definitions (current).
- Stage 1: dedicated KVM host preflight and hardening plan; no learner access.
- Stage 2: isolated controller and synthetic sessions; no student access.
- Stage 3: automated isolation, resource-limit, crash-recovery and teardown tests.
- Stage 4: independent security review and institution sign-off.
- Stage 5: supervised pilot capped at five concurrent learners, fixed images and short session expiry.
- Stage 6: gradual expansion based on measured capacity, incident evidence and approved quotas.
- Scale path: evaluate Firecracker only after the KVM pilot acceptance suite is stable.

Do not use Render, Vercel serverless functions, or a generic shared web container as the VM host. They are application hosting targets, not a substitute for a dedicated KVM worker host.
