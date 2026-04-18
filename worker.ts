import { startWorker } from "./src/queue/worker";

const worker = startWorker();
console.log("Worker started, waiting for jobs...");

process.on("SIGTERM", async () => {
  await worker.close();
});
