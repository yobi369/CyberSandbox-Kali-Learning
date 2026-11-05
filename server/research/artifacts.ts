import { createHash } from 'node:crypto';

export type DatasetIntakeRecord = {
  datasetId: string;
  projectId: string;
  sha256: string;
  byteSize: number;
  mediaType: string;
  license: string;
  consentBasis: string;
  storageKey: string;
  scanStatus: 'pending' | 'clean' | 'rejected' | 'unavailable';
  scannedAt: string | null;
  scannerVersion: string | null;
};

export type ResearchArtifact = {
  name: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
};

export type ResearchResultManifest = {
  schemaVersion: 1;
  experimentId: string;
  sourceCommit: string;
  environmentDigest: string;
  dependencyLockDigest: string;
  workerImageDigest: string;
  randomSeed: number;
  startedAt: string;
  completedAt: string;
  exitCode: number;
  artifacts: ResearchArtifact[];
  resourceUsage: { cpuMillis: number; peakMemoryMiB: number; diskWrittenMiB: number };
};

export function validateDatasetIntake(record: DatasetIntakeRecord): void {
  if (!/^[0-9a-f-]{36}$/i.test(record.datasetId) || !/^[0-9a-f-]{36}$/i.test(record.projectId)) throw new Error('Dataset and project IDs must be UUIDs.');
  if (!/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('Dataset checksum must be SHA-256.');
  if (!Number.isSafeInteger(record.byteSize) || record.byteSize < 1 || record.byteSize > 10 * 1024 * 1024 * 1024) throw new Error('Dataset size exceeds the 10 GiB policy limit.');
  if (!record.mediaType || record.mediaType.length > 160 || !record.license.trim() || !record.consentBasis.trim()) throw new Error('Dataset media type, license and consent basis are required.');
  if (!record.storageKey || record.storageKey.startsWith('/') || record.storageKey.includes('..') || record.storageKey.length > 512) throw new Error('Dataset storage key must be an opaque relative object key.');
  if (record.scanStatus !== 'clean' || !record.scannedAt || !record.scannerVersion?.trim() || !Number.isFinite(Date.parse(record.scannedAt))) {
    throw new Error('Dataset remains quarantined until a versioned malware scanner reports a clean result.');
  }
}

export function validateResearchResultManifest(manifest: ResearchResultManifest): void {
  if (manifest.schemaVersion !== 1 || !/^[0-9a-f-]{36}$/i.test(manifest.experimentId)) throw new Error('Unsupported result manifest or invalid experiment ID.');
  if (!/^[a-f0-9]{40}$/i.test(manifest.sourceCommit)) throw new Error('Result must identify an immutable source commit.');
  for (const digest of [manifest.environmentDigest, manifest.dependencyLockDigest, manifest.workerImageDigest]) {
    if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('All execution images and environments must be pinned by SHA-256 digest.');
  }
  if (!Number.isSafeInteger(manifest.randomSeed) || manifest.randomSeed < 0 || !Number.isInteger(manifest.exitCode)) throw new Error('Result must include a deterministic seed and integer exit code.');
  const start = Date.parse(manifest.startedAt);
  const end = Date.parse(manifest.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Result timestamps are invalid.');
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length > 1000) throw new Error('Artifact list exceeds the manifest limit.');
  const keys = new Set<string>();
  for (const artifact of manifest.artifacts) {
    if (!artifact.name.trim() || artifact.name.length > 240 || !artifact.mediaType || !Number.isSafeInteger(artifact.byteSize) || artifact.byteSize < 0 ||
        !/^[a-f0-9]{64}$/.test(artifact.sha256) || !artifact.storageKey || artifact.storageKey.startsWith('/') || artifact.storageKey.includes('..')) {
      throw new Error('Every result artifact must have a safe key, size, media type and SHA-256 checksum.');
    }
    if (keys.has(artifact.storageKey)) throw new Error('Duplicate artifact storage keys are not allowed.');
    keys.add(artifact.storageKey);
  }
  const usage = manifest.resourceUsage;
  if (![usage.cpuMillis, usage.peakMemoryMiB, usage.diskWrittenMiB].every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error('Resource usage must contain non-negative integer measurements.');
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
