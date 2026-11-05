import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LabProvisionRequest } from './orchestrator.js';

export type WorkerCapabilities = {
  firecrackerVersion: string;
  jailerVersion: string;
  kernelVersion: string;
  kvmAvailable: boolean;
  cgroupV2: boolean;
  seccompAvailable: boolean;
  appArmorOrSelinux: boolean;
  imageDigests: string[];
};

export type WorkerHeartbeat = {
  workerId: string;
  observedAt: string;
  healthy: boolean;
  activeSessions: number;
  maxSessions: number;
  capabilities: WorkerCapabilities;
};

export type SignedLabJob = {
  version: 1;
  jobId: string;
  issuedAt: string;
  expiresAt: string;
  audience: string;
  request: LabProvisionRequest;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

export function signLabJob(job: SignedLabJob, secret: string): string {
  if (secret.length < 32) throw new Error('Worker signing secret must contain at least 32 characters.');
  return createHmac('sha256', secret).update(canonical(job)).digest('hex');
}

export function verifyLabJob(job: SignedLabJob, signature: string, secret: string, expectedAudience: string, now = Date.now()): boolean {
  if (secret.length < 32 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const issued = Date.parse(job.issuedAt);
  const expires = Date.parse(job.expiresAt);
  if (job.version !== 1 || job.audience !== expectedAudience || !Number.isFinite(issued) ||
      !Number.isFinite(expires) || issued > now + 30_000 || expires <= now ||
      expires <= issued || expires - issued > 5 * 60_000) return false;
  const expected = Buffer.from(signLabJob(job, secret), 'hex');
  const supplied = Buffer.from(signature, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function validateWorkerHeartbeat(heartbeat: WorkerHeartbeat, now = Date.now()): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/.test(heartbeat.workerId)) throw new Error('Invalid worker identity.');
  const observed = Date.parse(heartbeat.observedAt);
  if (!Number.isFinite(observed) || observed > now + 30_000 || now - observed > 60_000) throw new Error('Worker heartbeat is stale or from the future.');
  if (!heartbeat.healthy || !heartbeat.capabilities.kvmAvailable || !heartbeat.capabilities.cgroupV2 ||
      !heartbeat.capabilities.seccompAvailable || !heartbeat.capabilities.appArmorOrSelinux) {
    throw new Error('Worker does not satisfy the minimum isolation capability profile.');
  }
  if (!heartbeat.capabilities.firecrackerVersion.trim() || !heartbeat.capabilities.jailerVersion.trim() ||
      !heartbeat.capabilities.kernelVersion.trim()) throw new Error('Worker runtime versions must be reported.');
  if (!Number.isInteger(heartbeat.activeSessions) || !Number.isInteger(heartbeat.maxSessions) ||
      heartbeat.activeSessions < 0 || heartbeat.maxSessions < 1 || heartbeat.activeSessions >= heartbeat.maxSessions) {
    throw new Error('Worker has no available session capacity.');
  }
}

export type LabSessionState = 'requested' | 'authorized' | 'provisioning' | 'ready' | 'active' | 'stopping' | 'destroying' | 'destroyed' | 'failed' | 'expired';

const transitions: Record<LabSessionState, LabSessionState[]> = {
  requested: ['authorized','failed','expired'],
  authorized: ['provisioning','failed','expired'],
  provisioning: ['ready','destroying','failed','expired'],
  ready: ['active','stopping','destroying','failed','expired'],
  active: ['stopping','destroying','failed','expired'],
  stopping: ['destroying','failed','expired'],
  destroying: ['destroyed','failed'],
  destroyed: [],
  failed: ['destroying'],
  expired: ['destroying'],
};

export function assertLabTransition(from: LabSessionState, to: LabSessionState): void {
  if (!transitions[from].includes(to)) throw new Error(`Invalid lab lifecycle transition: ${from} -> ${to}`);
}

export function assertDestroyedEvidence(evidence: { providerId: string; stopped: boolean; destroyed: boolean; verified: boolean; verifiedAt: string }): void {
  if (!evidence.providerId || !evidence.stopped || !evidence.destroyed || !evidence.verified ||
      !Number.isFinite(Date.parse(evidence.verifiedAt))) {
    throw new Error('A lab session cannot be marked destroyed without verified provider teardown evidence.');
  }
}
