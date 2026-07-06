// Optional V6/V7 scheduled Worker.
// Pages Functions do not run Cron Triggers directly.
// Deploy this later as a separate Cloudflare Worker and add a Cron Trigger.
//
// It calls your Pages API endpoint on a schedule.

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(env.NIMBUS_SCAN_URL || "https://YOUR-PAGES-DOMAIN/api/search", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({q:"", countries:["US","UK","JP","BR"]})
    }));
  }
};
