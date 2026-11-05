import { describe, expect, it } from 'vitest';
import { hashLeaseToken, validateResearchQueueRequest, type ResearchQueueRequest } from './queue.js';

const valid: ResearchQueueRequest = {
  experimentId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  sourceCommit: 'a'.repeat(40),
  environmentDigest: 'sha256:' + 'b'.repeat(64),
  dependencyLockDigest: 'sha256:' + 'c'.repeat(64),
  randomSeed: 7,
  protocol: { method: 'replicated-simulation', replicates: 10 },
  datasets: [{ datasetId: '33333333-3333-4333-8333-333333333333', sha256: 'd'.repeat(64), license: 'CC-BY-4.0', consentBasis: 'Approved ethics protocol' }],
  quota: { cpuMillis: 2000, memoryMiB: 2048, diskMiB: 4096, maxDurationSeconds: 3600 },
  networkPolicy: 'deny-all',
};

describe('research execution queue admission', () => {
  it('accepts a pinned, bounded, governed manifest', () => {
    expect(() => validateResearchQueueRequest(valid)).not.toThrow();
  });
  it('rejects mutable source references and excessive resource requests', () => {
    expect(() => validateResearchQueueRequest({ ...valid, sourceCommit: 'main' })).toThrow(/immutable/i);
    expect(() => validateResearchQueueRequest({ ...valid, quota: { ...valid.quota, cpuMillis: 64000 } })).toThrow(/quota/i);
  });
  it('requires governed dataset metadata', () => {
    expect(() => validateResearchQueueRequest({ ...valid, datasets: [{ ...valid.datasets[0], consentBasis: '' }] })).toThrow(/dataset/i);
  });
  it('stores only a one-way digest of lease bearer tokens', () => {
    const token = 'worker-secret-token';
    expect(hashLeaseToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLeaseToken(token)).not.toBe(token);
  });
});
