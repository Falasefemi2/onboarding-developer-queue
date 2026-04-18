export const createSchemaMigrationsTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    executed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createWorkflowTable = `
CREATE TABLE IF NOT EXISTS workflows (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    developer_id     TEXT NOT NULL UNIQUE,
    email            TEXT NOT NULL UNIQUE,
    company_name     TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',
    current_step     TEXT,
    total_steps      INT NOT NULL DEFAULT 10,
    completed_steps  INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,

    CHECK (total_steps >= 0),
    CHECK (completed_steps >= 0),
    CHECK (completed_steps <= total_steps)
);
`;

export const createWorkflowStepsTable = `
CREATE TABLE IF NOT EXISTS workflow_steps (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_id    TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_name      TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    attempt        INT NOT NULL DEFAULT 0,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    error_message  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workflow_id, step_name),
    CHECK (attempt >= 0)
);
`;

export const createApiKeyTable = `
CREATE TABLE IF NOT EXISTS api_keys (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    key_prefix    TEXT NOT NULL,
    hashed_key    TEXT NOT NULL,
    environment   TEXT NOT NULL DEFAULT 'sandbox',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createSandboxEnvironmentTable = `
CREATE TABLE IF NOT EXISTS sandbox_environments (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    namespace     TEXT NOT NULL UNIQUE,
    status        TEXT NOT NULL DEFAULT 'active',
    config        JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createRateLimitRulesTable = `
CREATE TABLE IF NOT EXISTS rate_limit_rules (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    endpoint      TEXT NOT NULL,
    limit_per_min INT NOT NULL,
    limit_per_day INT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (limit_per_min > 0),
    CHECK (limit_per_day > 0)
);
`;

export const createWebhookEndpointTable = `
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    url           TEXT NOT NULL,
    events        TEXT[] NOT NULL DEFAULT '{}',
    secret        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createWorkflowIndexes = `
CREATE INDEX IF NOT EXISTS idx_workflows_developer_id
ON workflows(developer_id);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id
ON workflow_steps(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_status
ON workflow_steps(status);
`;

export const createEmailLogsTable = `
CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    provider_message_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createEmailLogIndexes = `
CREATE INDEX IF NOT EXISTS idx_email_logs_workflow_id
ON email_logs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_status
ON email_logs(status);

CREATE INDEX IF NOT EXISTS idx_email_logs_workflow_created_at
ON email_logs(workflow_id, created_at DESC);
`;
