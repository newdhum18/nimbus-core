function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateSourceRank(metrics = {}, priority = 50) {
  const requests = Math.max(0, finite(metrics.requests));
  const successes = Math.max(0, finite(metrics.successes));
  const validLinks = Math.max(0, finite(metrics.valid_links ?? metrics.validLinks));
  const timeouts = Math.max(0, finite(metrics.timeouts));
  const blocks = Math.max(0, finite(metrics.blocks));
  const consecutiveFailures = Math.max(0, finite(metrics.consecutive_failures ?? metrics.consecutiveFailures));
  const latency = Math.max(0, finite(metrics.average_latency ?? metrics.averageLatency));

  const successRate = requests > 0 ? successes / requests : 0;
  const yieldPerRequest = requests > 0 ? validLinks / requests : 0;
  const latencyPenalty = Math.min(15, latency / 1000);
  const failurePenalty = Math.min(25, consecutiveFailures * 3);
  const reliabilityPenalty = requests > 0 ? ((timeouts + blocks) / requests) * 20 : 0;
  const explorationBonus = requests === 0 ? 5 : 0;
  const priorityWeight = clamp(finite(priority, 50), 0, 1000) / 100;

  return Number(clamp(
    priorityWeight +
    successRate * 25 +
    Math.min(50, yieldPerRequest * 12.5) +
    explorationBonus -
    latencyPenalty -
    failurePenalty -
    reliabilityPenalty,
    0,
    100
  ).toFixed(4));
}

export function sourceRecommendation(source) {
  const requests = Math.max(0, finite(source.requests));
  const consecutiveFailures = Math.max(0, finite(source.consecutive_failures));
  const blocks = Math.max(0, finite(source.blocks));
  const rankScore = finite(source.rank_score);

  if (requests >= 10 && consecutiveFailures >= 5) return "review_disable";
  if (requests >= 10 && blocks / requests >= 0.5) return "review_blocked";
  if (!source.enabled && rankScore >= 35) return "review_enable";
  return "keep";
}
