export function unwrapCommonRedirect(value) {
  try {
    const url = new URL(value);
    for (const key of ["url", "u", "target", "redirect", "redirect_url", "q"]) {
      const candidate = url.searchParams.get(key);
      if (candidate?.includes("mega.nz")) return candidate;
    }
  } catch {
    return value;
  }
  return value;
}
