// V10 optional external scheduled Worker.
// Preferred: use the scheduled() handler inside _worker.js.
// If you deploy this as a separate Worker, add NIMBUS_SCAN_URL and CRON_SECRET.

export default {
  async scheduled(event, env, ctx) {
    if (!env.NIMBUS_SCAN_URL || !env.CRON_SECRET) return;
    ctx.waitUntil(fetch(env.NIMBUS_SCAN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nimbus-cron-secret": env.CRON_SECRET
      },
      body: JSON.stringify({auto:true})
    }));
  }
};
