import { serveStatic } from "@hono/node-server/serve-static";
import { HonoAdapter } from "@bull-board/hono";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { serve } from "@hono/node-server";
import { app } from "./src/api/server";
import { startWorker } from "./src/queue/worker";
import { onboardingQueue } from "./src/queue/queue";

const worker = startWorker();

const serverAdapter = new HonoAdapter(serveStatic);
const basePath = "/ui";

// Set base path BEFORE createBullBoard
serverAdapter.setBasePath(basePath);

createBullBoard({
  queues: [new BullMQAdapter(onboardingQueue)],
  serverAdapter,
});

// Mount at '/' because setBasePath('/ui') already adds the /ui prefix to all routes
app.route('/', serverAdapter.registerPlugin());

serve({ fetch: app.fetch, port: 3000 }, ({ address, port }) => {
  console.log(`Server running on ${address}:${port}`);
  console.log(`Bull Board at http://localhost:${port}/ui`);
});

process.on("SIGTERM", async () => {
  await worker.close();
});
