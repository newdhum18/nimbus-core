// Future scheduled Worker for V8.
// Deploy separately as a Cloudflare Worker with Cron Trigger.

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(env.NIMBUS_SCAN_URL || "https://YOUR-PAGES-DOMAIN/api/search", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({q:"", countries:["US","UK","JP","BR"], limitPages:50})
    }));
  }
};
