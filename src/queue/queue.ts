import { Queue } from "bullmq";
import { connection } from "./redis";

export const onboardingQueue = new Queue("onboarding", { connection });
