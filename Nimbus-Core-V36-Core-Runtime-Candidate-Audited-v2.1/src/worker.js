import { route } from "./router.js";
import { consumeBatch } from "./queue/consumer.js";

export default {
  fetch(request, env) {
    return route(request, env);
  },

  queue(batch, env) {
    return consumeBatch(batch, env);
  }
};
