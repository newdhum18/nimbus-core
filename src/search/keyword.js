import { AppError } from "../api/errors.js";

export function buildQuery(keyword) {
  const clean = String(keyword ?? "").trim().replace(/\s+/g, " ");
  if (!clean) {
    throw new AppError("KEYWORD_REQUIRED", "Keyword is required", "search", 400);
  }
  return clean;
}
