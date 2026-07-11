export function rankSource({
  priority = 0,
  rank_score = 0,
  requests = 0,
  valid_links = 0,
  consecutive_failures = 0
}) {
  const yieldRate = requests > 0 ? valid_links / requests : 0;
  return Number(priority) +
    Number(rank_score) +
    yieldRate * 100 -
    Number(consecutive_failures) * 10;
}
