import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, withInstitution } from '../database.js';

export type ResearchQueueRequest = {
  experimentId: string;
  projectId: string;
  sourceCommit: string;
  environmentDigest: string;
  dependencyLockDigest: string;
  randomSeed: number;
  protocol: Record<string, unknown>;
  datasets: Array<{ datasetId: string; sha256: string; license: string; consentBasis: string }>;
  quota: { cpuMillis: number; memoryMiB: number; diskMiB: number; maxDurationSeconds: number };
  networkPolicy: 'deny-all' | 'approved-datasets-only';
};

export type ClaimedResearchJob = {
  id: string;
  organizationId: string;
  resourceId: string;
  payload: ResearchQueueRequest;
  attemptCount: number;
  leaseExpiresAt: string;
  leaseToken: string;
};

function assertControlPlaneEnabled(): void {
  if (process.env.EXECUTION_CONTROL_PLANE_ENABLED !== 'true') {
    throw new Error('Execution control plane is disabled; no research worker may claim jobs.');
  }
}

function validateQueueRequest(input: ResearchQueueRequest): void {
  if (!/^[0-9a-f-]{36}$/i.test(input.experimentId) || !/^[0-9a-f-]{36}$/i.test(input.projectId)) throw new Error('Research job identifiers must be UUIDs.');
  if (!/^[a-f0-9]{40}$/i.test(input.sourceCommit)) throw new Error('Research jobs require an immutable source commit.');
  if (!/^sha256:[a-f0-9]{64}$/.test(input.environmentDigest) || !/^sha256:[a-f0-9]{64}$/.test(input.dependencyLockDigest)) throw new Error('Research environments must be pinned by SHA-256 digest.');
  if (!Number.isSafeInteger(input.randomSeed) || input.randomSeed < 0 || !input.protocol || typeof input.protocol !== 'object' || Array.isArray(input.protocol)) throw new Error('Research protocol and deterministic seed are required.');
  if (!Array.isArray(input.datasets) || input.datasets.length > 100) throw new Error('Invalid research dataset list.');
  for (const d of input.datasets) if (!/^[0-9a-f-]{36}$/i.test(d.datasetId) || !/^[a-f0-9]{64}$/.test(d.sha256) || !d.license.trim() || !d.consentBasis.trim()) throw new Error('Every dataset requires identity, checksum, license and consent basis.');
  const q = input.quota;
  if (!Number.isInteger(q.cpuMillis) || q.cpuMillis < 100 || q.cpuMillis > 8000 ||
      !Number.isInteger(q.memoryMiB) || q.memoryMiB < 256 || q.memoryMiB > 16384 ||
      !Number.isInteger(q.diskMiB) || q.diskMiB < 512 || q.diskMiB > 32768 ||
      !Number.isInteger(q.maxDurationSeconds) || q.maxDurationSeconds < 60 || q.maxDurationSeconds > 14400) throw new Error('Research job resource quota is outside policy.');
}

export async function enqueueResearchExperiment(organizationId: string, actorUserId: string, input: ResearchQueueRequest): Promise<string> {
  validateQueueRequest(input);
  return withInstitution(organizationId, async (client) => {
    const experiment = await client.query(
      `SELECT e.id,e.status,e.code_revision,e.environment_digest,e.dependency_lock_digest,
              w.project_id,p.ethics_status,p.status AS project_status
       FROM research_experiments e
       JOIN research_workspaces w ON w.organization_id=e.organization_id AND w.id=e.workspace_id
       JOIN research_projects p ON p.organization_id=w.organization_id AND p.id=w.project_id
       WHERE e.organization_id=$1 AND e.id=$2 AND e.created_by=$3 FOR UPDATE OF e`,
      [organizationId,input.experimentId,actorUserId],
    );
    const row = experiment.rows[0];
    if (!row || row.project_id !== input.projectId) throw new Error('Research experiment is not available in this institution.');
    if (row.status !== 'queued' || row.project_status !== 'active' || !['approved','not_required'].includes(row.ethics_status)) throw new Error('Experiment must belong to an active, ethics-cleared project and be queued.');
    if (row.code_revision.toLowerCase() !== input.sourceCommit.toLowerCase() ||
        row.environment_digest !== input.environmentDigest || row.dependency_lock_digest !== input.dependencyLockDigest) throw new Error('Manifest does not match the experiment’s immutable source and environment.');
    for (const dataset of input.datasets) {
      const found = await client.query(
        `SELECT 1 FROM research_datasets WHERE organization_id=$1 AND project_id=$2 AND id=$3
         AND sha256=$4 AND scan_status='clean' AND upload_state='available'`,
        [organizationId,input.projectId,dataset.datasetId,dataset.sha256],
      );
      if (!found.rowCount) throw new Error('A referenced dataset is missing, quarantined, or has a checksum mismatch.');
    }
    const payload = JSON.stringify(input);
    const digest = createHash('sha256').update(payload).digest('hex');
    const inserted = await client.query(
      `INSERT INTO execution_jobs(organization_id,job_type,resource_id,payload,payload_sha256)
       VALUES($1,'research_experiment',$2,$3::jsonb,$4) RETURNING id`,
      [organizationId,input.experimentId,payload,digest],
    );
    await client.query('UPDATE research_experiments SET status=$3 WHERE organization_id=$1 AND id=$2',[organizationId,input.experimentId,'queued']);
    await client.query(
      `INSERT INTO research_provenance(organization_id,project_id,experiment_id,actor_user_id,event_type,payload,sequence_no,previous_hash,event_hash)
       SELECT $1,$2,$3,$4,'experiment_queued',$5::jsonb,
         COALESCE((SELECT max(sequence_no)+1 FROM research_provenance WHERE organization_id=$1 AND project_id=$2),1),
         (SELECT event_hash FROM research_provenance WHERE organization_id=$1 AND project_id=$2 ORDER BY sequence_no DESC LIMIT 1),
         encode(digest(COALESCE((SELECT event_hash FROM research_provenance WHERE organization_id=$1 AND project_id=$2 ORDER BY sequence_no DESC LIMIT 1), '') || $5::text || now()::text,'sha256'),'hex')`,
      [organizationId,input.projectId,input.experimentId,actorUserId,JSON.stringify({jobId:inserted.rows[0].id,payloadSha256:digest})],
    );
    return inserted.rows[0].id as string;
  });
}

export function hashLeaseToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function claimResearchJob(workerId: string, leaseSeconds = 120): Promise<ClaimedResearchJob | null> {
  assertControlPlaneEnabled();
  if (!/^[0-9a-f-]{36}$/i.test(workerId) || !Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 300) throw new Error('Invalid worker ID or lease duration.');
  const token = randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.execution_control_plane','enabled',true)");
    const claimed = await client.query(
      "SELECT * FROM claim_execution_job($1,'research_cpu',$2,$3)",
      [workerId,hashLeaseToken(token),leaseSeconds],
    );
    await client.query('COMMIT');
    const row = claimed.rows[0];
    if (!row) return null;
    return { id:row.id,organizationId:row.organization_id,resourceId:row.resource_id,payload:row.payload,
      attemptCount:row.attempt_count,leaseExpiresAt:row.lease_expires_at,leaseToken:token };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function markResearchJobRunning(client: PoolClient, jobId: string, workerId: string, leaseToken: string): Promise<void> {
  const result = await client.query(
    `UPDATE execution_jobs SET status='running',started_at=COALESCE(started_at,now()),updated_at=now()
     WHERE id=$1 AND worker_id=$2 AND lease_token_hash=$3 AND status='leased' AND lease_expires_at>now()`,
    [jobId,workerId,hashLeaseToken(leaseToken)],
  );
  if (!result.rowCount) throw new Error('Research job lease is invalid, expired, or no longer owned by this worker.');
}

export async function finishResearchJob(client: PoolClient, input: { jobId: string; workerId: string; leaseToken: string; success: boolean; errorCode?: string }): Promise<void> {
  const status = input.success ? 'succeeded' : 'failed';
  const result = await client.query(
    `UPDATE execution_jobs SET status=$4,worker_id=NULL,lease_token_hash=NULL,lease_expires_at=NULL,
       completed_at=now(),last_error_code=$5,updated_at=now()
     WHERE id=$1 AND worker_id=$2 AND lease_token_hash=$3 AND status IN ('leased','running') AND lease_expires_at>now()
     RETURNING organization_id`,
    [input.jobId,input.workerId,hashLeaseToken(input.leaseToken),status,input.success ? null : (input.errorCode ?? 'worker_failed').slice(0,100)],
  );
  if (!result.rowCount) throw new Error('Research job lease is invalid, expired, or no longer owned by this worker.');
  await client.query('UPDATE execution_workers SET active_jobs=GREATEST(0,active_jobs-1),updated_at=now() WHERE id=$1',[input.workerId]);
  await client.query(
    'INSERT INTO execution_job_events(organization_id,job_id,event_type,details) VALUES($1,$2,$3,$4::jsonb)',
    [result.rows[0].organization_id,input.jobId,status,JSON.stringify({workerId:input.workerId,errorCode:input.errorCode ?? null})],
  );
}
