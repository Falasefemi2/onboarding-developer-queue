import { Effect } from "effect";
import type { StepEffect, StepInput } from "../libs/types";
import { isStepCompleted } from "../handlers/steps-tracker";
import { DatabaseClient } from "../database/connection";
import { DatabaseError } from "../libs/errors";

export const createAccount = (
  input: StepInput,
): StepEffect<{ workflowId: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(input.workflowId, "create-account");
    if (already)
      return {
        workflowId: input.workflowId,
      };
    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO workflows (id, developer_id, email, company_name, status)
        VALUES (
            ${input.workflowId},
            ${input.developerId},
            ${input.email},
            ${input.companyName ?? null},
            'running'
        )
        ON CONFLICT (developer_id) DO UPDATE
          SET status = 'running', updated_at = NOW()
        `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to upsert workflow",
          cause: err,
        }),
    });
    return {
      workflowId: input.workflowId,
    };
  });

export const generateApiKeys = (
  input: StepInput,
): StepEffect<{ apiKey: string; keyId: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(
      input.workflowId,
      "generate-api-keys",
    );
    if (already) {
      const { sql } = yield* DatabaseClient;
      const [row] = yield* Effect.tryPromise({
        try: () => sql`
          SELECT id, key_prefix FROM api_keys
          WHERE workflow_id = ${input.workflowId}
          LIMIT 1
        `,
        catch: (err) =>
          new DatabaseError({
            message: "failed to fetch existing key",
            cause: err,
          }),
      });
      return {
        apiKey: `${row?.key_prefix}_REDACTED`,
        keyId: row?.id as string,
      };
    }

    const { sql } = yield* DatabaseClient;
    const keyId = Bun.randomUUIDv7();

    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = Buffer.from(bytes).toString("hex");

    const rawKey = `sk_sandbox_${secret}`;
    const prefix = rawKey.slice(0, 16);

    // In production: hash the key with argon2id before storing
    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO api_keys (id, workflow_id, key_prefix, hashed_key, environment)
        VALUES (${keyId}, ${input.workflowId}, ${prefix}, ${rawKey}, 'sandbox')
      `,
      catch: (err) =>
        new DatabaseError({ message: "failed to store api key", cause: err }),
    });

    return { apiKey: rawKey, keyId };
  });

export const createSandbox = (
  input: StepInput,
): StepEffect<{ sandboxId: string; namespace: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(input.workflowId, "create-sandbox");
    if (already) {
      const { sql } = yield* DatabaseClient;
      const [row] = yield* Effect.tryPromise({
        try: () => sql`
            SELECT id, namesapce FROM sandbox_environments
            WHERE workflow_id = ${input.workflowId}
            LIMIT 1
            `,
        catch: (err) =>
          new DatabaseError({
            message: "failed to fetch existing sandbox",
            cause: err,
          }),
      });
      return {
        sandboxId: row?.id as string,
        namespace: row?.namespace as string,
      };
    }
    const { sql } = yield* DatabaseClient;
    const sandboxId = Bun.randomUUIDv7();
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = Buffer.from(bytes).toString("hex");
    const namespace = `sb_${input.developerId}_${secret}`.toLowerCase();

    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO sandbox_environments (id, workflow_id, namespace, status, config)
        VALUES (
          ${sandboxId},
          ${input.workflowId},
          ${namespace},
          'active',
          ${sql.json({
            region: "us-east-1",
            tier: "sandbox",
            maxRequests: 1000,
            expiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          })}
        )
      `,
      catch: (err) =>
        new DatabaseError({ message: "failed to create sandbox", cause: err }),
    });

    return { sandboxId, namespace };
  });

export const seedSandboxData = (
  input: StepInput,
): StepEffect<{ recordsSeeded: number }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(
      input.workflowId,
      "seed-sandbox-data",
    );
    if (already) return { recordsSeeded: 0 };

    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE sandbox_environments
        SET config = config || ${sql.json({
          seeded: true,
          sampleUsers: 10,
          sampleProducts: 25,
          sampleOrders: 50,
          seededAt: new Date().toISOString(),
        })}
        WHERE workflow_id = ${input.workflowId}
      `,
      catch: (err) =>
        new DatabaseError({ message: "failed to seed sandbox", cause: err }),
    });

    return { recordsSeeded: 85 };
  });

export const sendApiEmail = (
  input: StepInput & { apiKey?: string },
): StepEffect<{ messageId: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(input.workflowId, "send-api-email");

    if (already) {
      return {
        messageId: "already-sent",
      };
    }

    const { sql } = yield* DatabaseClient;

    // simulate network/email provider delay
    yield* Effect.sleep("2 seconds");

    const messageId = `msg_${Bun.randomUUIDv7()}`;

    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO email_logs (
          id,
          workflow_id,
          recipient,
          subject,
          status,
          metadata
        )
        VALUES (
          ${messageId},
          ${input.workflowId},
          ${input.email},
          'Your API Keys Are Ready',
          'sent',
          ${sql.json({
            provider: "simulated",
            sentAt: new Date().toISOString(),
            previewKey: input.apiKey ? `${input.apiKey.slice(0, 16)}...` : null,
          })}
        )
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to log email send",
          cause: err,
        }),
    });

    return {
      messageId,
    };
  });

export const createPostman = (
  input: StepInput,
): StepEffect<{ collectionUrl: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(input.workflowId, "create-postman");
    if (already) return { collectionUrl: "already-created" };

    // In production: call Postman API to fork collection and share it
    const collectionUrl = `https://api.postman.com/collections/sandbox-${input.workflowId}`;

    yield* Effect.log(
      `[create-postman] Collection created for ${input.developerId}: ${collectionUrl}`,
    );

    return { collectionUrl };
  });

export const setupRateLimiting = (
  input: StepInput,
): StepEffect<{ rulesCreated: number }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(input.workflowId, "rate-limiting");
    if (already) return { rulesCreated: 0 };

    const { sql } = yield* DatabaseClient;

    const rules = [
      { endpoint: "/api/*", limitPerMin: 60, limitPerDay: 5000 },
      { endpoint: "/api/auth/*", limitPerMin: 10, limitPerDay: 100 },
      { endpoint: "/api/data/*", limitPerMin: 100, limitPerDay: 10000 },
    ];

    yield* Effect.tryPromise({
      try: () =>
        Promise.all(
          rules.map(
            (rule) =>
              sql`
              INSERT INTO rate_limit_rules
                (workflow_id, endpoint, limit_per_min, limit_per_day)
              VALUES
                (${input.workflowId}, ${rule.endpoint}, ${rule.limitPerMin}, ${rule.limitPerDay})
            `,
          ),
        ),
      catch: (err) =>
        new DatabaseError({
          message: "failed to create rate limit rules",
          cause: err,
        }),
    });

    return { rulesCreated: rules.length };
  });

export const registerWebhooks = (
  input: StepInput,
): StepEffect<{ webhookId: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(
      input.workflowId,
      "register-webhooks",
    );
    if (already) return { webhookId: "already-registered" };

    const { sql } = yield* DatabaseClient;
    const webhookId = Bun.randomUUIDv7();
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const secrets = Buffer.from(bytes).toString("hex");
    const secret = `whsec_${secrets}`;

    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO webhook_endpoints (id, workflow_id, url, events, secret, status)
        VALUES (
          ${webhookId},
          ${input.workflowId},
          ${`https://sandbox.example.com/webhooks/${input.developerId}`},
          ${sql.array(["payment.completed", "subscription.updated", "user.created"])},
          ${secret},
          'active'
        )
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to register webhook",
          cause: err,
        }),
    });

    return { webhookId };
  });

export const sendSandboxEmail = (
  input: StepInput & { namespace?: string; collectionUrl?: string },
): StepEffect<{ messageId: string }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(
      input.workflowId,
      "send-sandbox-email",
    );

    if (already) {
      return { messageId: "already-sent" };
    }

    const { sql } = yield* DatabaseClient;

    const messageId = Bun.randomUUIDv7();

    const emailPayload = {
      to: input.email,
      subject: "Sandbox is ready",
      body: `
        Your sandbox environment is ready.

        Namespace: ${input.namespace ?? input.workflowId}
        Collection URL: ${input.collectionUrl ?? "#"}

        Message ID: ${messageId}
      `,
    };

    // simulate sending email (no external service abstraction)
    yield* Effect.sleep("1 second");

    // optional but realistic: log email send
    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO email_logs (
          id,
          workflow_id,
          recipient,
          subject,
          status,
          metadata,
          sent_at
        )
        VALUES (
          ${messageId},
          ${input.workflowId},
          ${input.email},
          ${emailPayload.subject},
          'sent',
          ${sql.json(emailPayload)},
          NOW()
        )
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to log sandbox email",
          cause: err,
        }),
    });

    return { messageId };
  });

export const notifySales = (
  input: StepInput,
): StepEffect<{ notified: boolean }> =>
  Effect.gen(function* () {
    const already = yield* isStepCompleted(input.workflowId, "notify-sales");

    if (already) {
      return { notified: false };
    }

    const { sql } = yield* DatabaseClient;

    const salesEmail = process.env.SALES_EMAIL ?? "sales@yourcompany.com";

    const messageId = Bun.randomUUIDv7();

    const emailPayload = {
      to: salesEmail,
      subject: "New Developer Signup",
      body: `
        A new developer has completed onboarding.

        Company: ${input.companyName ?? "N/A"}
        Developer Email: ${input.email}
        Workflow ID: ${input.workflowId}
      `,
    };

    // simulate sending email (no external service layer)
    yield* Effect.sleep("500 millis");

    // log notification
    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO email_logs (
          id,
          workflow_id,
          recipient,
          subject,
          status,
          metadata,
          sent_at
        )
        VALUES (
          ${messageId},
          ${input.workflowId},
          ${salesEmail},
          ${emailPayload.subject},
          'sent',
          ${sql.json(emailPayload)},
          NOW()
        )
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to log sales notification",
          cause: err,
        }),
    });

    return { notified: true };
  });
