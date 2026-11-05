# Isolated Kali Worker Deployment Runbook

## Deployment status

The application currently has a lab-definition registry and a database control-plane schema for sessions, quotas, lifecycle events and teardown evidence. The HTTP API deliberately returns 503 for live session creation. There is no deployed VM provider, worker host, virtual network, image registry or remote session gateway. No Kali VM is created by this repository today.

This is a security boundary, not a temporary UI limitation. Do not change the API to return a successful session until every gate below is independently tested.

## Target execution model

Use a dedicated Linux host pool with hardware virtualization and a microVM boundary (Firecracker/KVM is the preferred reference design). Do not run learner workloads inside the public web/API process, a shared application container, or a Docker socket exposed to the API.

Control plane:
- API authenticates the learner and checks course enrolment, lab approval, institution policy and concurrent-session quotas.
- The orchestrator creates a durable requested session record and a short-lived opaque session capability.
- A separate worker controller receives a signed, tenant-scoped job. It has no application database credentials.
- The controller creates a fresh microVM from an immutable, digest-pinned image and a read-only base root filesystem.
- A per-session tap/veth connects only to a dedicated lab bridge. Egress is deny-by-default and enforced outside the guest.
- A separate gateway proxies the learner's terminal/browser protocol. It does not expose SSH, VNC or worker management ports directly.
- The session expiry controller runs independently of browser connections and destroys expired or abandoned sessions.

## Host prerequisites

- Dedicated KVM-capable Linux hosts; /dev/kvm must be available and verified.
- Firecracker and jailer installed from a pinned, signature-verified release.
- Dedicated unprivileged worker account, cgroups v2, seccomp, namespaces, AppArmor/SELinux and a hardened host kernel.
- No shared Docker/container runtime socket, cloud metadata route, host filesystem mount or production subnet route.
- Separate management and lab network interfaces with explicit firewall policy.
- Private artifact registry with signed images, SBOMs, vulnerability scan results and immutable SHA-256 digests.
- Encrypted ephemeral storage with a documented destruction method.
- Worker identity and mutually authenticated control-plane communication; short-lived credentials only.

## Required default policy

- egress.default = deny.
- No public internet, institution LAN, cloud metadata, control-plane, database, worker management or other tenant access.
- Only explicitly approved lab targets on the same session's isolated virtual network may be reachable.
- No host networking, privileged guest, host mounts, runtime sockets, device passthrough or cross-session network path.
- CPU, memory, disk, process count, file descriptor count, bandwidth and wall-clock limits are enforced by the host.
- Session capability is bound to one user, one tenant, one session and a short expiry; revoke it on stop or failure.

## Lifecycle and failure handling

Allowed transitions:
requested -> authorized -> provisioning -> ready -> active -> stopping -> destroying -> destroyed

Any stage may transition to failed or expired. A row marked destroyed must have destroyed_at and teardown_verified = true.

The worker must be idempotent. Repeated stop/destroy requests cannot create new resources. Persist provider resource IDs before exposing the session. On timeout, worker crash or lost control-plane connection, a separate reconciler enumerates provider resources by immutable session labels and destroys orphans.

## Security acceptance tests (release blockers)

1. Two concurrent tenants cannot see, connect to or address one another's guest or artifacts.
2. Guest traffic to the public internet, RFC1918 institution ranges, IPv6 external routes, link-local metadata and control-plane endpoints is denied.
3. Host mounts, host networking, privileged mode, KVM device access from the guest, runtime sockets and management ports are unavailable.
4. CPU, memory, disk, process, bandwidth and wall-clock limits are enforced under adversarial load.
5. Kill the worker during every provisioning and teardown transition; prove no orphaned VM, tap device, bridge rule, volume or capability remains.
6. Restart the API, controller and host independently; reconcile the durable session state without duplicate VMs.
7. Verify image signatures/digests and reject mutable tags or unapproved images.
8. Verify logs contain no passwords, session capabilities, student submission bodies or sensitive guest data.
9. Run independent VM escape, network segmentation and control-plane penetration tests.
10. Prove backup/restore and secure destruction for session metadata and artifacts.

## Operational rollout

- Stage 0: metadata-only lab definitions (current).
- Stage 1: worker host and controller deployed in an isolated test account; no student access.
- Stage 2: synthetic sessions and automated failure/escape/network tests.
- Stage 3: independent security review and institution sign-off.
- Stage 4: small supervised pilot with fixed lab images, short expiry and low quotas.
- Stage 5: gradual expansion with active monitoring and incident response.

Do not use Render, Vercel serverless functions, or a generic shared web container as the microVM host. They are application hosting targets, not a substitute for a dedicated KVM worker pool.
