import { Effect } from "effect";
import {
  createAccount,
  createPostman,
  createSandbox,
  generateApiKeys,
  notifySales,
  registerWebhooks,
  seedSandboxData,
  sendApiEmail,
  sendSandboxEmail,
  setupRateLimiting,
} from "./src/jobs/steps";
import type { StepEffect, StepInput, WorkflowStep } from "./src/libs/types";
import { DatabaseLive } from "./src/database/connection";
import {
  markStepComplete,
  markStepFailed,
  markStepStarted,
  markWorkflowComplete,
} from "./src/handlers/steps-tracker";
import { onboardingQueue } from "./src/queue/queue";

export const workflowSteps = [
  "create-account",
  "generate-api-keys",
  "create-sandbox",
  "seed-sandbox-data",
  "send-api-email",
  "create-postman",
  "rate-limiting",
  "register-webhooks",
  "send-sandbox-email",
  "notify-sales",
] as const;

const stepHandlers: Record<
  WorkflowStep,
  (input: StepInput) => StepEffect<unknown>
> = {
  "create-account": createAccount,
  "generate-api-keys": generateApiKeys,
  "create-sandbox": createSandbox,
  "seed-sandbox-data": seedSandboxData,
  "send-api-email": sendApiEmail,
  "create-postman": createPostman,
  "rate-limiting": setupRateLimiting,
  "register-webhooks": registerWebhooks,
  "send-sandbox-email": sendSandboxEmail,
  "notify-sales": notifySales,
};

type WorkflowContext = Omit<StepInput, "stepName" | "stepAttempt">;

export const runWorkflow = (ctx: WorkflowContext) =>
  Effect.gen(function* () {
    console.log(`Starting workflow: ${ctx.workflowId}`);

    yield* Effect.forEach(
      workflowSteps,
      (stepName) => {
        const step = stepHandlers[stepName];
        const attempt = 1;
        const input: StepInput = {
          ...ctx,
          stepName,
          stepAttempt: attempt,
        };
        if (stepName === "create-account") {
          return step(input).pipe(
            Effect.asVoid,
            Effect.tap(() =>
              Effect.sync(() => console.log(`Completed: ${stepName}`)),
            ),
          );
        }

        return markStepStarted(ctx.workflowId, stepName, attempt).pipe(
          Effect.flatMap(() => step(input).pipe(Effect.asVoid)),
          Effect.flatMap(() => markStepComplete(ctx.workflowId, stepName)),
          Effect.tap(() =>
            Effect.sync(() => console.log(`Completed: ${stepName}`)),
          ),
          Effect.catchAll((err) =>
            markStepFailed(ctx.workflowId, stepName, err.message).pipe(
              Effect.flatMap(() => Effect.fail(err)),
            ),
          ),
        );
      },
      { concurrency: 1 }, // run steps sequentially
    );

    yield* markWorkflowComplete(ctx.workflowId);
    console.log("Workflow completed");
  });

const workflowId = Bun.randomUUIDv7();

const job = await onboardingQueue.add(
  "onboard-developer",
  {
    workflowId, // ← add this
    developerId: `dev_${Date.now()}`,
    email: `dev_${Date.now()}@example.com`,
    companyName: "New Corp",
  },
  {
    attempts: 3,
    backoff: { type: "fixed", delay: 5000 },
  },
);

console.log(`Job enqueued: ${job.id}`);
await onboardingQueue.close();
