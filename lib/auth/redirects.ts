export function getSafeNextPath(value: string | null | undefined, fallback = "/") {
  const nextPath = value?.trim();

  if (
    !nextPath ||
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\")
  ) {
    return fallback;
  }

  return nextPath;
}
