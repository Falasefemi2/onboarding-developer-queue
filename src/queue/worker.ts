import { Worker } from "bullmq";
import { Effect } from "effect";
import { connection } from "./redis";
import { runWorkflow } from "../../index";
import { DatabaseLive } from "../database/connection";
import type { WorkflowPayload } from "../libs/types";

export const startWorker = () => {
  const worker = new Worker(
    "onboarding",
    async (job) => {
      const payload = job.data as WorkflowPayload;

      await Effect.runPromise(
        runWorkflow({
          workflowId: payload.workflowId, // ← from payload, not job.id
          developerId: payload.developerId,
          email: payload.email,
          companyName: payload.companyName,
        }).pipe(Effect.provide(DatabaseLive)),
      );
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
};
