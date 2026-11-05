export type ResearchResourceQuota = {
  cpuMillis: number;
  memoryMiB: number;
  diskMiB: number;
  maxDurationSeconds: number;
};

export type ResearchDatasetReference = {
  datasetId: string;
  sha256: string;
  license: string;
  consentBasis: string;
};

export type ResearchExperimentManifest = {
  projectId: string;
  experimentId: string;
  sourceCommit: string;
  environmentDigest: string;
  dependencyLockDigest: string;
  randomSeed: number;
  protocol: Record<string, unknown>;
  datasets: ResearchDatasetReference[];
  quota: ResearchResourceQuota;
  networkPolicy: 'deny-all' | 'approved-datasets-only';
};

export function validateResearchManifest(manifest: ResearchExperimentManifest): void {
  for (const id of [manifest.projectId, manifest.experimentId]) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Research manifest identifiers must be UUIDs.');
  }
  if (!/^[a-f0-9]{40}$/i.test(manifest.sourceCommit)) throw new Error('Research runs require a full immutable Git commit SHA.');
  if (!/^sha256:[a-f0-9]{64}$/.test(manifest.environmentDigest) || !/^sha256:[a-f0-9]{64}$/.test(manifest.dependencyLockDigest)) {
    throw new Error('Environment and dependency lockfile must be identified by SHA-256 digest.');
  }
  if (!Number.isSafeInteger(manifest.randomSeed) || manifest.randomSeed < 0) throw new Error('A deterministic non-negative random seed is required.');
  if (!manifest.protocol || typeof manifest.protocol !== 'object' || Array.isArray(manifest.protocol)) throw new Error('A structured experiment protocol is required.');
  if (manifest.datasets.length > 100) throw new Error('A research run may reference at most 100 datasets.');
  for (const dataset of manifest.datasets) {
    if (!/^[0-9a-f-]{36}$/i.test(dataset.datasetId) || !/^[a-f0-9]{64}$/i.test(dataset.sha256) ||
        !dataset.license.trim() || !dataset.consentBasis.trim()) {
      throw new Error('Each dataset must include an ID, checksum, license and consent basis.');
    }
  }
  const q = manifest.quota;
  if (!Number.isInteger(q.cpuMillis) || q.cpuMillis < 100 || q.cpuMillis > 8000 ||
      !Number.isInteger(q.memoryMiB) || q.memoryMiB < 256 || q.memoryMiB > 16384 ||
      !Number.isInteger(q.diskMiB) || q.diskMiB < 512 || q.diskMiB > 32768 ||
      !Number.isInteger(q.maxDurationSeconds) || q.maxDurationSeconds < 60 || q.maxDurationSeconds > 14400) {
    throw new Error('Research resource quota is outside the approved limits.');
  }
}

export type ResearchExecutionResult = {
  providerRunId: string;
  status: 'completed' | 'failed' | 'cancelled';
  exitCode: number | null;
  startedAt: string;
  completedAt: string;
  workerImageDigest: string;
  outputManifestDigest: string | null;
  resourceUsage: { cpuMillis: number; peakMemoryMiB: number; diskWrittenMiB: number };
};

export interface IsolatedResearchProvider {
  execute(manifest: ResearchExperimentManifest): Promise<ResearchExecutionResult>;
  cancel(providerRunId: string): Promise<void>;
  verifyArtifacts(providerRunId: string, outputManifestDigest: string): Promise<boolean>;
}
