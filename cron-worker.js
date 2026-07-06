// Future V10 scheduled Worker.
// Requires storing a service token or dedicated scan endpoint.

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(env.NIMBUS_SCAN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.NIMBUS_SERVICE_TOKEN}`
      },
      body: JSON.stringify({q:"", countries:["ALL"], limitPages:80})
    }));
  }
};
