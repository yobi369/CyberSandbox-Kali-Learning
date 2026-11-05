export type LabQuota = {
  cpuMillis: number;
  memoryMiB: number;
  diskMiB: number;
  maxDurationSeconds: number;
};

export type EgressRule = {
  destinationCidr: string;
  protocol: 'tcp' | 'udp';
  ports: number[];
  purpose: string;
};

export type LabNetworkPolicy = {
  default: 'deny';
  allow: EgressRule[];
};

export type LabProvisionRequest = {
  sessionId: string;
  organizationId: string;
  userId: string;
  imageDigest: string;
  quota: LabQuota;
  network: LabNetworkPolicy;
  expiresAt: string;
};

export type ProviderVm = {
  providerId: string;
  attested: boolean;
  imageDigest: string;
  networkPolicyDigest: string;
};

export interface IsolatedLabProvider {
  createMicroVm(request: LabProvisionRequest): Promise<ProviderVm>;
  stopMicroVm(providerId: string): Promise<void>;
  destroyMicroVm(providerId: string): Promise<void>;
  verifyDestroyed(providerId: string): Promise<boolean>;
}

export class LabInfrastructureUnavailable extends Error {
  constructor() {
    super('No attested isolated lab provider is configured.');
    this.name = 'LabInfrastructureUnavailable';
  }
}

export function validateLabProvisionRequest(request: LabProvisionRequest): void {
  if (!/^[0-9a-f-]{36}$/i.test(request.sessionId) || !/^[0-9a-f-]{36}$/i.test(request.organizationId) || !/^[0-9a-f-]{36}$/i.test(request.userId)) {
    throw new Error('Lab identity fields must be UUIDs.');
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(request.imageDigest)) throw new Error('Lab images must be pinned by SHA-256 digest.');
  const q = request.quota;
  if (!Number.isInteger(q.cpuMillis) || q.cpuMillis < 100 || q.cpuMillis > 8000 ||
      !Number.isInteger(q.memoryMiB) || q.memoryMiB < 256 || q.memoryMiB > 16384 ||
      !Number.isInteger(q.diskMiB) || q.diskMiB < 512 || q.diskMiB > 32768 ||
      !Number.isInteger(q.maxDurationSeconds) || q.maxDurationSeconds < 60 || q.maxDurationSeconds > 14400) {
    throw new Error('Lab resource quota is outside the enforced policy bounds.');
  }
  if (request.network.default !== 'deny' || request.network.allow.length > 20) {
    throw new Error('Lab network policy must be deny-by-default with a bounded allowlist.');
  }
  for (const rule of request.network.allow) {
    if (!rule.destinationCidr || rule.destinationCidr === '0.0.0.0/0' || rule.destinationCidr === '::/0' ||
        !['tcp','udp'].includes(rule.protocol) || rule.ports.length < 1 || rule.ports.length > 32 ||
        rule.ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535) ||
        rule.purpose.trim().length < 8 || rule.purpose.length > 240) {
      throw new Error('Every egress exception must have a narrow destination, protocol, ports and documented purpose.');
    }
  }
  const expiry = new Date(request.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + q.maxDurationSeconds * 1000 + 30_000) {
    throw new Error('Lab expiry must be in the future and within the maximum session duration.');
  }
}

export class LabOrchestrator {
  constructor(private readonly provider: IsolatedLabProvider | null) {}

  async provision(request: LabProvisionRequest): Promise<ProviderVm> {
    validateLabProvisionRequest(request);
    if (!this.provider) throw new LabInfrastructureUnavailable();
    let vm: ProviderVm | null = null;
    try {
      vm = await this.provider.createMicroVm(request);
      if (!vm.attested || vm.imageDigest !== request.imageDigest || !vm.providerId || !vm.networkPolicyDigest) {
        throw new Error('Worker attestation, immutable image identity or network policy verification failed.');
      }
      return vm;
    } catch (error) {
      if (vm?.providerId) await this.destroyAndVerify(vm.providerId);
      throw error;
    }
  }

  async destroyAndVerify(providerId: string): Promise<void> {
    if (!this.provider) throw new LabInfrastructureUnavailable();
    await this.provider.stopMicroVm(providerId).catch(() => undefined);
    await this.provider.destroyMicroVm(providerId);
    if (!await this.provider.verifyDestroyed(providerId)) {
      throw new Error('Lab teardown could not be verified; session must remain in destroying state and trigger incident handling.');
    }
  }
}
