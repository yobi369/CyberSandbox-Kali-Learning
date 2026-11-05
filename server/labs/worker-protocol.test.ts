import { describe, expect, it } from 'vitest';
import { assertDestroyedEvidence, assertLabTransition, signLabJob, validateWorkerHeartbeat, verifyLabJob, type SignedLabJob, type WorkerHeartbeat } from './worker-protocol.js';

const secret = 'test-secret-that-is-longer-than-thirty-two-characters';
const job: SignedLabJob = {
  version: 1, jobId: 'job-123456', issuedAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(), audience: 'cybersandbox-worker',
  request: {
    sessionId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222',
    userId: '33333333-3333-4333-8333-333333333333', imageDigest: 'sha256:' + 'a'.repeat(64),
    quota: { cpuMillis: 1000, memoryMiB: 1024, diskMiB: 2048, maxDurationSeconds: 600 },
    network: { default: 'deny', allow: [] }, expiresAt: new Date(Date.now() + 60_000).toISOString(),
  },
};
const heartbeat: WorkerHeartbeat = {
  workerId: 'worker-a01', observedAt: new Date().toISOString(), healthy: true, activeSessions: 1, maxSessions: 4,
  capabilities: { firecrackerVersion: '1.10.1', jailerVersion: '1.10.1', kernelVersion: '6.8',
    kvmAvailable: true, cgroupV2: true, seccompAvailable: true, appArmorOrSelinux: true, imageDigests: [] },
};

describe('worker protocol', () => {
  it('signs and verifies short-lived audience-bound jobs', () => {
    const signature = signLabJob(job, secret);
    expect(verifyLabJob(job, signature, secret, 'cybersandbox-worker')).toBe(true);
    expect(verifyLabJob(job, signature, secret, 'other-worker')).toBe(false);
    expect(verifyLabJob({ ...job, jobId: 'tampered' }, signature, secret, 'cybersandbox-worker')).toBe(false);
  });
  it('rejects stale or under-capable workers', () => {
    expect(() => validateWorkerHeartbeat(heartbeat)).not.toThrow();
    expect(() => validateWorkerHeartbeat({ ...heartbeat, capabilities: { ...heartbeat.capabilities, kvmAvailable: false } })).toThrow(/isolation/i);
    expect(() => validateWorkerHeartbeat({ ...heartbeat, activeSessions: 4 })).toThrow(/capacity/i);
  });
  it('enforces explicit lifecycle and teardown evidence', () => {
    expect(() => assertLabTransition('active','destroyed')).toThrow(/transition/i);
    expect(() => assertLabTransition('destroying','destroyed')).not.toThrow();
    expect(() => assertDestroyedEvidence({ providerId: 'vm-1', stopped: true, destroyed: true, verified: false, verifiedAt: new Date().toISOString() })).toThrow(/evidence/i);
  });
});
