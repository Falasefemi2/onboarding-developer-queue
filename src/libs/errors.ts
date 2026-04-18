import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
  cause?: unknown;
}> {}

export class StepError extends Data.TaggedError("StepError")<{
  message: string;
  stepName: string;
  cause?: unknown;
}> {}

export class QueueError extends Data.TaggedError("QueueError")<{
  message: string;
  cause?: unknown;
}> {}

export type OnboardingError = DatabaseError | StepError | QueueError;
