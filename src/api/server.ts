import { Hono } from "hono";
import { onboardingQueue } from "../queue/queue";

export const app = new Hono();

app.post("/onboard", async (c) => {
  const body = await c.req.json<{
    email: string;
    companyName?: string;
  }>();

  if (!body.email) {
    return c.json({ error: "email is required" }, 400);
  }

  const workflowId = Bun.randomUUIDv7();
  const developerId = `dev_${Bun.randomUUIDv7()}`;

  const job = await onboardingQueue.add(
    "onboard-developer",
    {
      workflowId,
      developerId,
      email: body.email,
      companyName: body.companyName,
    },
    {
      attempts: 3,
      backoff: { type: "fixed", delay: 5000 },
    },
  );

  return c.json(
    {
      status: "accepted",
      jobId: job.id,
      workflowId,
      message: "Onboarding started, you will receive an email shortly",
    },
    202,
  );
});
