import { SYSTEM } from "../config.js";

export function health() {
  return {
    service: SYSTEM.worker,
    version: SYSTEM.version,
    status: "healthy"
  };
}

export function bindings(env) {
  return {
    db: Boolean(env.DB),
    queue: Boolean(env.QUEUE)
  };
}
