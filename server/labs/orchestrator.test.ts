import { describe, expect, it } from 'vitest';
import { LabInfrastructureUnavailable, LabOrchestrator, validateLabProvisionRequest, type LabProvisionRequest, type IsolatedLabProvider } from './orchestrator.js';

const request: LabProvisionRequest = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  userId: '33333333-3333-4333-8333-333333333333',
  imageDigest: 'sha256:' + 'a'.repeat(64),
  quota: { cpuMillis: 1000, memoryMiB: 2048, diskMiB: 4096, maxDurationSeconds: 1800 },
  network: { default: 'deny', allow: [] },
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};

describe('isolated lab orchestration safety contract', () => {
  it('fails closed when no provider is connected', async () => {
    const orchestrator = new LabOrchestrator(null);
    await expect(orchestrator.provision(request)).rejects.toBeInstanceOf(LabInfrastructureUnavailable);
  });

  it('rejects broad egress and out-of-policy quotas', () => {
    expect(() => validateLabProvisionRequest({ ...request, network: { default: 'deny', allow: [{ destinationCidr: '0.0.0.0/0', protocol: 'tcp', ports: [443], purpose: 'all outbound access' }] } })).toThrow(/narrow destination/i);
    expect(() => validateLabProvisionRequest({ ...request, quota: { ...request.quota, memoryMiB: 65536 } })).toThrow(/quota/i);
  });

  it('destroys an unattested VM and requires verified teardown', async () => {
    const calls: string[] = [];
    const provider: IsolatedLabProvider = {
      async createMicroVm() { return { providerId: 'vm-test', attested: false, imageDigest: request.imageDigest, networkPolicyDigest: 'sha256:' + 'b'.repeat(64) }; },
      async stopMicroVm(id) { calls.push('stop:' + id); },
      async destroyMicroVm(id) { calls.push('destroy:' + id); },
      async verifyDestroyed(id) { calls.push('verify:' + id); return true; },
    };
    const orchestrator = new LabOrchestrator(provider);
    await expect(orchestrator.provision(request)).rejects.toThrow(/attestation/i);
    expect(calls).toEqual(['stop:vm-test','destroy:vm-test','verify:vm-test']);
  });
});
