import { Effect } from "effect";
import type { StepEffect } from "../libs/types";
import { DatabaseClient } from "../database/connection";
import { DatabaseError } from "../libs/errors";

export const markStepStarted = (
  workflowId: string,
  stepName: string,
  attempt: number,
): StepEffect<void> =>
  Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`
        INSERT INTO workflow_steps (workflow_id, step_name, status, attempt, started_at)
        VALUES (${workflowId}, ${stepName}, 'running', ${attempt}, NOW())
        ON CONFLICT (workflow_id, step_name)
        DO UPDATE SET
          status = 'running',
          attempt = ${attempt},
          started_at = NOW(),
          error_message = NULL
        `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to mark step started",
          cause: err,
        }),
    });
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE workflows
        SET current_step = ${stepName}, updated_at = NOW()
        WHERE id = ${workflowId}
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to update current step",
          cause: err,
        }),
    });
  });

export const markStepComplete = (
  workflowId: string,
  stepName: string,
): StepEffect<void> =>
  Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE workflow_steps
        SET status = 'completed', completed_at = NOW()
        WHERE workflow_id = ${workflowId} AND step_name = ${stepName}
      `,
      catch: (err) =>
        new DatabaseError({ message: "failed to complete step", cause: err }),
    });
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE workflows
        SET completed_steps = completed_steps + 1, updated_at = NOW()
        WHERE id = ${workflowId}
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to update completed_steps",
          cause: err,
        }),
    });
  });

export const markStepFailed = (
  workflowId: string,
  stepName: string,
  errorMessage: string,
): StepEffect<void> =>
  Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE workflow_steps
        SET status = 'failed', error_message = ${errorMessage}, completed_at = NOW()
        WHERE workflow_id = ${workflowId} AND step_name = ${stepName}
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to mark step failed",
          cause: err,
        }),
    });
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE workflows
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${workflowId}
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to update workflow status",
          cause: err,
        }),
    });
  });

export const markWorkflowComplete = (workflowId: string): StepEffect<void> =>
  Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    yield* Effect.tryPromise({
      try: () => sql`
        UPDATE workflows
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${workflowId}
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to complete workflow",
          cause: err,
        }),
    });
  });

export const getCompletedSteps = (
  workflowId: string,
): StepEffect<Set<string>> =>
  Effect.gen(function* () {
    const { sql } = yield* DatabaseClient;
    const rows = yield* Effect.tryPromise({
      try: () => sql`
        SELECT step_name FROM workflow_steps
        WHERE workflow_id = ${workflowId} AND status = 'completed'
      `,
      catch: (err) =>
        new DatabaseError({
          message: "failed to fetch completed steps",
          cause: err,
        }),
    });
    return new Set(rows.map((r) => r.step_name as string));
  });

export const isStepCompleted = (
  workflowId: string,
  stepName: string,
): StepEffect<boolean> =>
  Effect.gen(function* () {
    const completed = yield* getCompletedSteps(workflowId);
    return completed.has(stepName);
  });
