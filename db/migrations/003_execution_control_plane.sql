-- Durable execution queues, worker inventory, leases, and dataset scan evidence.
CREATE TABLE IF NOT EXISTS execution_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('firecracker','research_cpu','research_gpu')),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','healthy','draining','quarantined')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_jobs integer NOT NULL DEFAULT 0 CHECK (active_jobs >= 0),
  max_jobs integer NOT NULL CHECK (max_jobs BETWEEN 1 AND 256),
  last_heartbeat_at timestamptz,
  attestation_digest text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (worker_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$')
);
CREATE INDEX IF NOT EXISTS execution_workers_eligible_idx
  ON execution_workers(provider,status,last_heartbeat_at) WHERE status = 'healthy';

CREATE TABLE IF NOT EXISTS execution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('isolated_lab','research_experiment','dataset_scan')),
  resource_id uuid NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','running','succeeded','failed','cancelled','dead_letter')),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN -100 AND 100),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  worker_id uuid REFERENCES execution_workers(id),
  lease_token_hash char(64),
  lease_expires_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, resource_id) REFERENCES research_experiments(organization_id,id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((status IN ('leased','running')) = (worker_id IS NOT NULL)),
  CHECK (status NOT IN ('leased','running') OR (lease_token_hash IS NOT NULL AND lease_expires_at IS NOT NULL)),
  UNIQUE (organization_id,id)
);
-- Resource linkage differs by job type; the composite FK is intentionally deferred,
-- but lab and scan jobs are represented by a separate resource reference table.
ALTER TABLE execution_jobs DROP CONSTRAINT IF EXISTS execution_jobs_organization_id_resource_id_fkey;
CREATE INDEX IF NOT EXISTS execution_jobs_claim_idx
  ON execution_jobs(status,available_at,priority DESC,created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS execution_jobs_lease_idx
  ON execution_jobs(status,lease_expires_at) WHERE status IN ('leased','running');
CREATE UNIQUE INDEX IF NOT EXISTS execution_jobs_resource_active_idx
  ON execution_jobs(organization_id,job_type,resource_id)
  WHERE status IN ('queued','leased','running');

CREATE TABLE IF NOT EXISTS execution_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,job_id) REFERENCES execution_jobs(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS execution_job_events_job_idx ON execution_job_events(organization_id,job_id,occurred_at);

ALTER TABLE research_datasets
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending','scanning','clean','rejected','unavailable')),
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scanner_version text,
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'unconfigured',
  ADD COLUMN IF NOT EXISTS upload_state text NOT NULL DEFAULT 'quarantined'
    CHECK (upload_state IN ('quarantined','available','rejected','deleted'));
CREATE INDEX IF NOT EXISTS research_datasets_scan_queue_idx
  ON research_datasets(scan_status,created_at) WHERE scan_status IN ('pending','unavailable');

ALTER TABLE execution_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_workers FORCE ROW LEVEL SECURITY;
ALTER TABLE execution_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE execution_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_job_events FORCE ROW LEVEL SECURITY;

CREATE POLICY execution_jobs_tenant_isolation ON execution_jobs
  USING (organization_id::text = current_setting('app.current_organization_id',true) OR current_setting('app.execution_control_plane',true) = 'enabled')
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id',true) OR current_setting('app.execution_control_plane',true) = 'enabled');
CREATE POLICY execution_job_events_tenant_isolation ON execution_job_events
  USING (organization_id::text = current_setting('app.current_organization_id',true) OR current_setting('app.execution_control_plane',true) = 'enabled')
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id',true) OR current_setting('app.execution_control_plane',true) = 'enabled');
-- Worker inventory is platform-operated and is not visible to tenant application roles.
CREATE POLICY execution_workers_platform_only ON execution_workers
  USING (current_setting('app.execution_control_plane',true) = 'enabled')
  WITH CHECK (current_setting('app.execution_control_plane',true) = 'enabled');
CREATE POLICY research_experiments_control_plane ON research_experiments
  USING (organization_id::text = current_setting('app.current_organization_id',true) OR current_setting('app.execution_control_plane',true) = 'enabled')
  WITH CHECK (organization_id::text = current_setting('app.current_organization_id',true) OR current_setting('app.execution_control_plane',true) = 'enabled');

CREATE OR REPLACE FUNCTION claim_execution_job(
  p_worker_id uuid, p_provider text, p_lease_token_hash char(64), p_lease_seconds integer
) RETURNS SETOF execution_jobs LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE claimed execution_jobs;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'Execution job lease must be between 30 and 300 seconds';
  END IF;
  WITH expired AS (SELECT worker_id FROM execution_jobs WHERE status IN ('leased','running') AND lease_expires_at < now() AND attempt_count < max_attempts)
  UPDATE execution_workers w SET active_jobs = GREATEST(0,w.active_jobs - x.n), updated_at = now()
  FROM (SELECT worker_id,count(*)::integer AS n FROM expired GROUP BY worker_id) x WHERE w.id = x.worker_id;
  UPDATE execution_jobs SET status = 'queued', worker_id = NULL, lease_token_hash = NULL,
    lease_expires_at = NULL, available_at = now(), updated_at = now()
  WHERE status IN ('leased','running') AND lease_expires_at < now() AND attempt_count < max_attempts;
  WITH expired AS (SELECT worker_id FROM execution_jobs WHERE status IN ('leased','running') AND lease_expires_at < now() AND attempt_count >= max_attempts)
  UPDATE execution_workers w SET active_jobs = GREATEST(0,w.active_jobs - x.n), updated_at = now()
  FROM (SELECT worker_id,count(*)::integer AS n FROM expired GROUP BY worker_id) x WHERE w.id = x.worker_id;
  UPDATE execution_jobs SET status = 'dead_letter', worker_id = NULL, lease_token_hash = NULL,
    lease_expires_at = NULL, completed_at = now(), last_error_code = 'lease_expired_max_attempts', updated_at = now()
  WHERE status IN ('leased','running') AND lease_expires_at < now() AND attempt_count >= max_attempts;
  UPDATE research_experiments e SET status='failed',completed_at=now()
    FROM execution_jobs j WHERE j.resource_id=e.id AND j.organization_id=e.organization_id
      AND j.job_type='research_experiment' AND j.status='dead_letter' AND e.status='running';
  IF NOT EXISTS (SELECT 1 FROM execution_workers WHERE id = p_worker_id
      AND provider = p_provider AND status = 'healthy'
      AND last_heartbeat_at > now() - interval '60 seconds'
      AND active_jobs < max_jobs FOR UPDATE) THEN
    RAISE EXCEPTION 'Worker is not eligible to claim execution jobs';
  END IF;
  SELECT * INTO claimed FROM execution_jobs
  WHERE status = 'queued' AND available_at <= now()
    AND ((p_provider = 'firecracker' AND job_type = 'isolated_lab')
      OR (p_provider IN ('research_cpu','research_gpu') AND job_type = 'research_experiment')
      OR (p_provider = 'research_cpu' AND job_type = 'dataset_scan'))
  ORDER BY priority DESC,created_at
  FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE execution_jobs SET status = 'leased', worker_id = p_worker_id,
    lease_token_hash = p_lease_token_hash, lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = attempt_count + 1, updated_at = now()
  WHERE id = claimed.id RETURNING * INTO claimed;
  UPDATE execution_workers SET active_jobs = active_jobs + 1, updated_at = now() WHERE id = p_worker_id;
  INSERT INTO execution_job_events(organization_id,job_id,event_type,details)
    VALUES(claimed.organization_id,claimed.id,'leased',jsonb_build_object('worker_id',p_worker_id));
  RETURN NEXT claimed;
END $$;
