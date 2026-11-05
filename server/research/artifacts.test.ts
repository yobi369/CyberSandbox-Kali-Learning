import { describe, expect, it } from 'vitest';
import { sha256Hex, validateDatasetIntake, validateResearchResultManifest, type DatasetIntakeRecord, type ResearchResultManifest } from './artifacts.js';

const dataset: DatasetIntakeRecord = {
  datasetId: '11111111-1111-4111-8111-111111111111', projectId: '22222222-2222-4222-8222-222222222222',
  sha256: 'a'.repeat(64), byteSize: 1024, mediaType: 'text/csv', license: 'CC-BY-4.0',
  consentBasis: 'Institutional ethics approval ABC-123', storageKey: 'quarantine/tenant/object',
  scanStatus: 'clean', scannedAt: new Date().toISOString(), scannerVersion: 'clamav-1.4',
};
const manifest: ResearchResultManifest = {
  schemaVersion: 1, experimentId: '33333333-3333-4333-8333-333333333333', sourceCommit: 'a'.repeat(40),
  environmentDigest: 'sha256:' + 'b'.repeat(64), dependencyLockDigest: 'sha256:' + 'c'.repeat(64),
  workerImageDigest: 'sha256:' + 'd'.repeat(64), randomSeed: 42,
  startedAt: new Date(Date.now() - 1000).toISOString(), completedAt: new Date().toISOString(), exitCode: 0,
  artifacts: [{ name: 'results.csv', mediaType: 'text/csv', byteSize: 20, sha256: 'e'.repeat(64), storageKey: 'artifacts/tenant/experiment/results.csv' }],
  resourceUsage: { cpuMillis: 2000, peakMemoryMiB: 512, diskWrittenMiB: 4 },
};

describe('research artifact governance', () => {
  it('accepts only clean, scanned, governed dataset objects', () => {
    expect(() => validateDatasetIntake(dataset)).not.toThrow();
    expect(() => validateDatasetIntake({ ...dataset, scanStatus: 'pending', scannedAt: null })).toThrow(/quarantined/i);
    expect(() => validateDatasetIntake({ ...dataset, storageKey: '../escape' })).toThrow(/storage key/i);
  });
  it('validates immutable execution provenance and artifact checksums', () => {
    expect(() => validateResearchResultManifest(manifest)).not.toThrow();
    expect(() => validateResearchResultManifest({ ...manifest, workerImageDigest: 'latest' })).toThrow(/sha-256/i);
    expect(() => validateResearchResultManifest({ ...manifest, artifacts: [manifest.artifacts[0], manifest.artifacts[0]] })).toThrow(/duplicate/i);
  });
  it('computes a fixed-length SHA-256 digest over exact uploaded bytes', () => {
    const digest = sha256Hex(new TextEncoder().encode('research-data'));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Hex(new TextEncoder().encode('research-data'))).toBe(digest);
  });
});
