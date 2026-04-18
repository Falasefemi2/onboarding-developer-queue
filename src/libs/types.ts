import type { Effect } from "effect";
import type { DatabaseError, StepError } from "./errors";
import type { DatabaseClient } from "../database/connection";

export type WorkflowStep =
  | "create-account"
  | "generate-api-keys"
  | "create-sandbox"
  | "seed-sandbox-data"
  | "send-api-email"
  | "create-postman"
  | "rate-limiting"
  | "register-webhooks"
  | "send-sandbox-email"
  | "notify-sales";

export const WORKFLOW_STEPS: WorkflowStep[] = [
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
];

export type StepInput = {
  workflowId: string;
  developerId: string;
  email: string;
  companyName?: string;
  stepAttempt: number;
  stepName: WorkflowStep;
};

export type StepEffect<A> = Effect.Effect<
  A,
  StepError | DatabaseError,
  DatabaseClient
>;

export type WorkflowPayload = {
  workflowId: string; // ← add this
  developerId: string;
  email: string;
  companyName?: string;
};
