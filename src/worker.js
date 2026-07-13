import { route } from "./router.js";
import { consumeBatch } from "./queue/consumer.js";
import { runQueueWatchdog } from "./queue/watchdog.js";

export default {
  fetch(request, env) { return route(request, env); },
  queue(batch, env) { return consumeBatch(batch, env); },
  scheduled(_controller, env, ctx) { ctx.waitUntil(runQueueWatchdog(env)); }
};
