# KVM/QEMU Pilot Host Foundation

## Status and scope

**Status: architecture and pre-deployment specification only.** This document does not provision a host, create a virtual machine, open a network path, or authorize student access.

The first live-lab milestone uses one dedicated KVM-capable Linux host and one isolated QEMU/KVM virtual machine per learner session. The initial pilot is capped at five supervised learners. Firecracker remains the later scale-out option after the KVM pilot has passed independent isolation and operational testing.

The public GitHub Pages simulator remains separate and unchanged. The platform API must continue to reject live session creation with HTTP 503 until the worker and all release gates are implemented and verified.

## 1. Target architecture

Keep the control plane, hypervisor host, learner gateway, and lab targets in separate trust zones.

```text
Learner browser
    |
    | HTTPS / WSS (short-lived, session-scoped capability)
    v
Web application + API
    |
    | authenticated, signed, narrowly scoped worker job
    v
Worker controller (separate service identity)
    |
    | libvirt API over a local, restricted socket
    v
Dedicated KVM host
    |-- per-session Kali guest (QEMU/KVM)
    |-- per-session target guest(s), when required
    |-- per-session isolated virtual network
    |-- host-enforced firewall and resource controls
    |
    +---- separate management interface / network

Browser terminal gateway is a separate service. It brokers an approved terminal protocol
to the session guest and never exposes SSH, libvirt, or host management ports to learners.
```

### Trust boundaries

1. **Application/API:** authenticates the learner, checks enrolment, lab approval, institution policy, quota and session ownership. It does not hold libvirt credentials or hypervisor access.
2. **Worker controller:** accepts only authenticated, schema-validated jobs with an immutable session ID, tenant ID, approved image digest, resource profile and expiry. It has no application database credentials.
3. **Hypervisor host:** runs QEMU under an unprivileged identity with mandatory confinement and host-enforced resource and network policy.
4. **Lab network:** isolated per session. Kali can reach only the targets explicitly attached to that same session.
5. **Terminal gateway:** provides browser access through a short-lived capability bound to one user, tenant and session. It cannot administer the host or other sessions.

## 2. Host baseline

Use a dedicated bare-metal server with hardware virtualization enabled in firmware. A virtual private server is acceptable only if the provider explicitly exposes nested virtualization and the full isolation design can be independently tested; do not assume that a generic cloud VM supports KVM.

Preferred initial host baseline:

- Ubuntu Server 24.04 LTS or another supported Linux distribution with a maintained kernel and libvirt/QEMU packages.
- x86_64 CPU with VT-x or AMD-V enabled; verify KVM acceleration rather than assuming it.
- cgroups v2, namespaces, seccomp, AppArmor or SELinux, and a supported nftables firewall.
- Separate physical or logically isolated management and lab interfaces. Management access must never be reachable from learner guests.
- Encrypted host storage, monitored free-space thresholds, and a documented secure disposal procedure for ephemeral session disks.
- A dedicated non-login or tightly restricted worker service identity; no routine operation as root.
- Time synchronisation, centralised security logs, host metrics, alerting and tested out-of-band recovery.

### Preflight checks (read-only)

Run these on a candidate host before installing or enabling the worker:

```bash
uname -a
lscpu
test -c /dev/kvm && ls -l /dev/kvm
systemd-detect-virt
findmnt -no FSTYPE /
stat -fc %T /sys/fs/cgroup
sudo virt-host-validate
```

Expected evidence:

- CPU flags include `vmx` (Intel) or `svm` (AMD).
- `/dev/kvm` exists and is accessible only to the intended hypervisor service identity.
- cgroup filesystem reports `cgroup2fs`.
- `virt-host-validate` has no unexplained blocking failures.
- Host virtualization, IOMMU and security features are documented; unsupported checks are recorded rather than silently ignored.

These checks are diagnostic only. Do not install packages, change firewall rules, or create guests until the host owner has approved the change plan.

## 3. VM lifecycle and image model

Use libvirt/QEMU with KVM acceleration. Each learner session receives a fresh guest from an approved, immutable Kali base image.

- Pin the base image by SHA-256 digest and record its build provenance, Kali release, package snapshot/date, installed tool versions and vulnerability scan.
- Keep the golden base image read-only. Create a separate ephemeral copy-on-write overlay for each session.
- Never reuse a writable learner disk between tenants.
- Do not attach host directories, the Docker/container runtime socket, host devices, cloud metadata paths or production credentials to learner guests.
- Do not expose the QEMU monitor, libvirt socket, SPICE, VNC or SSH management ports to learner networks.
- Use libvirt security drivers (sVirt with SELinux or AppArmor confinement, as supported by the host), unprivileged QEMU processes, seccomp and namespaces.
- Apply explicit CPU, memory, disk I/O, disk capacity, process, file-descriptor and wall-clock limits. Validate enforcement under load.
- Require idempotent create, stop, reset and destroy operations. Persist provider resource IDs before a session can be marked ready.
- A session is not destroyed merely because the API row says so. The controller must confirm that the domain, overlay disk, virtual NIC, network policy and short-lived capability are gone.

Do not enable arbitrary ISO uploads, custom kernel modules, nested virtualisation, USB passthrough or learner-selected VM configuration in the first pilot.

## 4. Network isolation model

Network policy is enforced on the host, not by guest configuration.

- Create a distinct isolated network for every session; do not put all learner guests on one shared bridge.
- Do not assign the lab bridge a route to the management network, institution LAN, database subnet, control-plane subnet or public internet.
- Apply deny-by-default IPv4 and IPv6 policy at the host boundary. IPv6 must be explicitly filtered or disabled for the lab segment; it must not become an unmonitored bypass.
- Permit only the minimum traffic required between a learner's Kali VM and the intentionally vulnerable target VMs attached to that same session.
- Deny host services, link-local metadata addresses, DNS to uncontrolled resolvers, lateral movement to other sessions, and all unapproved destinations.
- If package installation is required, provide a controlled mirror/proxy with allowlisted destinations and logging; do not grant general guest egress.
- Test traffic from inside the guest and from a compromised target, including spoofed source addresses, DNS manipulation, IPv6, link-local and unexpected routes.

The first cohort should use prebuilt vulnerable targets owned or explicitly licensed by the project. Do not expose third-party systems or public IP ranges as practice targets.

## 5. Pilot resource envelope

The pilot limit is **five concurrent learners**, not a claim that any particular host can support five VMs. Capacity must be measured on the selected hardware.

For each session, define a versioned resource profile with:

- vCPU count and CPU quota;
- RAM maximum and memory pressure behaviour;
- overlay disk quota and I/O rate;
- process and file-descriptor limits;
- network bandwidth and packet-rate controls;
- maximum session duration and idle timeout;
- maximum number of target VMs;
- maximum concurrent sessions per learner and institution.

Calculate capacity from measured peak usage, reserve host capacity for the operating system and controller, and fail closed when capacity is exhausted. Do not overcommit memory for the first pilot.

## 6. Controller and API contract

The controller exposes a private, authenticated job interface—not a general-purpose hypervisor API.

Minimum operations:

- `createSession`: validates an approved image digest and resource profile, creates isolated network and guest resources, then reports readiness.
- `extendSession`: accepts only a bounded extension approved by policy; cannot exceed the configured hard maximum.
- `resetSession`: destroys learner state and recreates the guest from the approved base image.
- `destroySession`: revokes access first, destroys guests and network resources, removes ephemeral storage, and returns verifiable teardown evidence.
- `reconcile`: enumerates resources by immutable session labels and removes orphaned resources after controller/API/host failure.

Jobs must be authenticated, replay-resistant, time-limited, tenant-scoped and idempotent. The controller must reject unknown fields, arbitrary shell commands, arbitrary libvirt XML, arbitrary image URLs and learner-supplied host paths.

The application API must not report a session as ready until the controller confirms that the VM, network policy and terminal route are established. On worker unavailability or any ambiguous state, keep the session unavailable and preserve the existing HTTP 503 behaviour.

## 7. Browser access

Start with a browser terminal, not a streamed desktop.

- Use a separately deployed terminal gateway and WebSocket over HTTPS.
- Authenticate every connection against the session capability and re-check ownership on reconnect.
- Never place SSH private keys, host credentials, libvirt credentials or reusable session secrets in browser storage or frontend bundles.
- Bind each terminal route to one session and one guest; deny cross-session routing.
- Apply connection limits, idle expiry, origin checks, message-size limits and rate limits.
- Record session lifecycle and security-relevant metadata. If command/output recording is enabled, disclose it clearly, define retention and restrict instructor access.

noVNC or Apache Guacamole can be evaluated later for approved GUI exercises. They must use the same session isolation and short-lived access model.

## 8. Failure handling and teardown proof

Allowed lifecycle:

`requested -> authorized -> provisioning -> ready -> active -> stopping -> destroying -> destroyed`

Any non-terminal state may transition to `failed` or `expired`. A database row marked `destroyed` must include a verified timestamp and evidence from the worker.

Test interruption at every transition:

- controller process termination;
- host reboot or loss of power;
- API restart and network partition;
- guest crash and disk exhaustion;
- terminal gateway disconnect;
- timeout during network, VM or disk creation;
- repeated and concurrent stop requests.

The reconciler must be independent of browser connections and must not depend on the original worker process remaining alive. It must locate resources using immutable labels and remove orphaned domains, overlays, tap devices, firewall rules, networks and capabilities.

## 9. Release gates

Live student access remains blocked until all gates are evidenced:

1. Host preflight passes and host ownership/change approval is documented.
2. KVM acceleration is confirmed; QEMU runs unprivileged under mandatory confinement.
3. Two concurrent sessions cannot discover, address or connect to one another.
4. Guest-to-host, guest-to-management, guest-to-metadata, guest-to-institution-LAN and unapproved internet traffic are denied over IPv4 and IPv6.
5. CPU, memory, disk, process, bandwidth and wall-clock limits are demonstrated under adversarial load.
6. Immutable image verification rejects changed digests and unapproved images.
7. Controller/API/host failures at each lifecycle stage leave no orphaned resources or reusable capabilities.
8. Destroy and reset operations are repeatable and independently verified.
9. Terminal access cannot cross session or tenant boundaries.
10. Independent security testing covers VM escape, network segmentation and control-plane access.
11. Monitoring, incident response, kill switch, backup/restore and data retention procedures are tested.
12. Institutional approval, learner acceptable-use terms and privacy review are complete.

A successful CI run, a successful VM boot, or a green health endpoint is not evidence that these gates have passed.

## 10. Migration to Firecracker

Do not introduce Firecracker during the first pilot. Revisit it only after the QEMU/KVM controller contract, image pipeline, network policy, session lifecycle, observability and teardown tests are stable.

The Firecracker implementation must satisfy the same worker protocol and acceptance suite. It is a runtime replacement, not a relaxation of the security boundary.

## 11. Current implementation boundary

At the time of this specification:

- The application has lab-definition and session metadata foundations.
- The live session API deliberately returns HTTP 503.
- No dedicated KVM host, QEMU worker controller, per-session lab network, browser terminal gateway or live Kali image is deployed by this repository.
- The public simulator remains static and does not execute commands or network traffic.

Do not describe the platform as providing live labs until a supervised pilot has passed the release gates above.
