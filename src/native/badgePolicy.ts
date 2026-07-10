export type BadgePlan =
  | { kind: "dock"; label: string }
  | { kind: "app"; count?: number }
  | { kind: "overlay"; count: number }
  | { kind: "none" };

export function normalizeBadgeCacheKey(count: number): number {
  return count === -1 ? -1 : Math.min(count, 10);
}

export function badgePlan(platform: NodeJS.Platform, count: number): BadgePlan {
  if (platform === "darwin") {
    return { kind: "dock", label: count === -1 ? "•" : count === 0 ? "" : String(count) };
  }
  if (platform === "linux") {
    return count === -1 ? { kind: "app" } : { kind: "app", count };
  }
  if (platform === "win32") return { kind: "overlay", count };
  return { kind: "none" };
}